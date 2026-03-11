$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Load-DotEnvFile([string]$filePath) {
  if (-not (Test-Path $filePath)) { return }
  Get-Content $filePath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Write-JsonResponse($context, [int]$statusCode, $payload) {
  $json = $payload | ConvertTo-Json -Depth 8 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $response = $context.Response
  $response.StatusCode = $statusCode
  $response.ContentType = "application/json; charset=utf-8"
  $response.Headers["Access-Control-Allow-Origin"] = "*"
  $response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
  $response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Api-Key"
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.OutputStream.Close()
}

function Extract-AccessKey([string]$raw) {
  $value = if ($null -eq $raw) { "" } else { $raw }
  $digits = ($value -replace "\D", "")
  if ($digits.Length -eq 44) { return $digits }
  $m = [regex]::Match($digits, "\d{44}")
  if ($m.Success) { return $m.Value }
  return ""
}

function Extract-NFNumber([string]$raw) {
  $value = if ($null -eq $raw) { "" } else { $raw }
  $digits = ($value -replace "\D", "")
  if ($digits.Length -eq 44) {
    $n = $digits.Substring(25, 9) -replace "^0+", ""
    if ([string]::IsNullOrWhiteSpace($n)) { return "0" }
    return $n
  }
  $m = [regex]::Match($digits, "\d{44}")
  if ($m.Success) {
    $n = $m.Value.Substring(25, 9) -replace "^0+", ""
    if ([string]::IsNullOrWhiteSpace($n)) { return "0" }
    return $n
  }
  if (-not [string]::IsNullOrWhiteSpace($digits)) { return $digits }
  return $value.Trim()
}

function Extract-XmlFromPayload($payload) {
  if ($null -eq $payload) { return "" }
  if ($payload -is [string]) { return $payload }

  $keys = @("xml", "xmlContent", "xml_conteudo", "conteudoXml", "conteudo_xml", "content")
  foreach ($k in $keys) {
    if ($payload.PSObject.Properties.Name -contains $k) {
      $v = [string]$payload.$k
      if (-not [string]::IsNullOrWhiteSpace($v)) { return $v }
    }
  }
  return ""
}

function Read-RequestBody($request) {
  if (-not $request.HasEntityBody) { return @{} }
  $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
  $raw = $reader.ReadToEnd()
  $reader.Close()
  if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
  try {
    return $raw | ConvertFrom-Json
  } catch {
    throw "JSON invalido no body"
  }
}

function Request-UpstreamXml([string]$codigo, [string]$chaveAcesso, [string]$numeroNF) {
  $upstreamUrl = [string]$env:SEFAZ_UPSTREAM_URL
  if ([string]::IsNullOrWhiteSpace($upstreamUrl)) {
    throw "SEFAZ_UPSTREAM_URL nao configurada no ambiente do proxy"
  }

  $method = [string]$env:SEFAZ_UPSTREAM_METHOD
  if ([string]::IsNullOrWhiteSpace($method)) { $method = "POST" }
  $method = $method.ToUpperInvariant()

  $headers = @{ Accept = "application/json, text/xml, application/xml, text/plain" }
  $token = [string]$env:SEFAZ_UPSTREAM_TOKEN
  if (-not [string]::IsNullOrWhiteSpace($token)) {
    $headers["Authorization"] = "Bearer $token"
  }

  if ($method -eq "GET") {
    $query = "codigo=$([uri]::EscapeDataString($codigo))"
    if (-not [string]::IsNullOrWhiteSpace($chaveAcesso)) {
      $query += "&chave=$([uri]::EscapeDataString($chaveAcesso))"
    }
    if (-not [string]::IsNullOrWhiteSpace($numeroNF)) {
      $query += "&numeroNF=$([uri]::EscapeDataString($numeroNF))"
    }
    $url = if ($upstreamUrl.Contains("?")) { "$upstreamUrl&$query" } else { "$upstreamUrl`?$query" }
    $resp = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -UseBasicParsing
  } else {
    $headers["Content-Type"] = "application/json"
    $body = @{ codigo = $codigo; chaveAcesso = $chaveAcesso; numeroNF = $numeroNF } | ConvertTo-Json -Compress
    $resp = Invoke-WebRequest -Uri $upstreamUrl -Method POST -Headers $headers -Body $body -UseBasicParsing
  }

  $contentType = [string]$resp.Headers["Content-Type"]
  $content = [string]$resp.Content
  if ($contentType.ToLowerInvariant().Contains("application/json")) {
    try {
      $payload = $content | ConvertFrom-Json
      return (Extract-XmlFromPayload $payload)
    } catch {
      return ""
    }
  }
  return $content
}

Load-DotEnvFile (Join-Path $scriptDir "integracao_supabase_importer\.env")

if (-not $env:SEFAZ_PROXY_PORT) { $env:SEFAZ_PROXY_PORT = "8790" }
if (-not $env:SEFAZ_XML_API_URL) { $env:SEFAZ_XML_API_URL = "http://127.0.0.1:$($env:SEFAZ_PROXY_PORT)/sefaz/xml" }
if (-not $env:SEFAZ_XML_API_METHOD) { $env:SEFAZ_XML_API_METHOD = "POST" }

$port = 8790
[void][int]::TryParse($env:SEFAZ_PROXY_PORT, [ref]$port)
$apiKey = [string]$env:SEFAZ_PROXY_API_KEY

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host "[SEFAZ Proxy] Iniciando em http://127.0.0.1:$port"
if ([string]::IsNullOrWhiteSpace($env:SEFAZ_UPSTREAM_URL)) {
  Write-Warning "[SEFAZ Proxy] SEFAZ_UPSTREAM_URL nao configurada. Configure para baixar XML real da SEFAZ."
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $path = $request.Url.AbsolutePath

    if ($request.HttpMethod -eq "OPTIONS") {
      Write-JsonResponse $context 200 @{ ok = $true }
      continue
    }

    if ($path -eq "/health") {
      Write-JsonResponse $context 200 @{
        ok = $true
        service = "sefaz-proxy"
        upstreamConfigured = -not [string]::IsNullOrWhiteSpace($env:SEFAZ_UPSTREAM_URL)
        port = $port
      }
      continue
    }

    if ($path -ne "/sefaz/xml") {
      Write-JsonResponse $context 404 @{ ok = $false; error = "Rota nao encontrada" }
      continue
    }

    if (-not [string]::IsNullOrWhiteSpace($apiKey)) {
      $incomingApiKey = [string]$request.Headers["X-Api-Key"]
      if ($incomingApiKey -ne $apiKey) {
        Write-JsonResponse $context 401 @{ ok = $false; error = "API key invalida" }
        continue
      }
    }

    try {
      $codigo = ""
      if ($request.HttpMethod -eq "GET") {
        $codigo = [string]$request.QueryString["codigo"]
      } elseif ($request.HttpMethod -eq "POST") {
        $body = Read-RequestBody $request
        if ($null -ne $body.codigo -and -not [string]::IsNullOrWhiteSpace([string]$body.codigo)) {
          $codigo = [string]$body.codigo
        } elseif ($null -ne $body.numeroNF -and -not [string]::IsNullOrWhiteSpace([string]$body.numeroNF)) {
          $codigo = [string]$body.numeroNF
        } elseif ($null -ne $body.chaveAcesso -and -not [string]::IsNullOrWhiteSpace([string]$body.chaveAcesso)) {
          $codigo = [string]$body.chaveAcesso
        }
      } else {
        Write-JsonResponse $context 405 @{ ok = $false; error = "Metodo nao permitido" }
        continue
      }

      if ([string]::IsNullOrWhiteSpace($codigo)) {
        Write-JsonResponse $context 400 @{ ok = $false; error = "codigo obrigatorio" }
        continue
      }

      $chaveAcesso = Extract-AccessKey $codigo
      $numeroNF = Extract-NFNumber $codigo
      $xml = Request-UpstreamXml $codigo $chaveAcesso $numeroNF

      if ([string]::IsNullOrWhiteSpace($xml)) {
        throw "Upstream nao retornou XML"
      }

      Write-JsonResponse $context 200 @{
        ok = $true
        numeroNF = $numeroNF
        chaveAcesso = $chaveAcesso
        xml = $xml
        source = "sefaz-proxy"
      }
    } catch {
      Write-JsonResponse $context 502 @{
        ok = $false
        error = [string]$_.Exception.Message
      }
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
