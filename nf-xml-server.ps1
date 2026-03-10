$ErrorActionPreference = 'Stop'

$port = 8787

function Resolve-XmlBaseDir {
    $defaultExactPath = 'C:\Users\junio.gomes\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app'

    if (Test-Path -LiteralPath $defaultExactPath) {
        return $defaultExactPath
    }

    if (-not [string]::IsNullOrWhiteSpace($env:NF_XML_DIR) -and (Test-Path -LiteralPath $env:NF_XML_DIR)) {
        return $env:NF_XML_DIR
    }

    $candidatePatterns = @(
        'C:\Users\junio.gomes\Capric* T*xtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app',
        'C:\Users\junio.gomes\*\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app',
        'C:\Users\junio.gomes\OneDrive - *\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app'
    )

    foreach ($pattern in $candidatePatterns) {
        $match = Get-Item -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $match -and (Test-Path -LiteralPath $match.FullName)) {
            return $match.FullName
        }
    }

    # Retorna o caminho padrão mesmo sem existir para facilitar diagnóstico no /api/health.
    return $defaultExactPath
}

$xmlBaseDir = Resolve-XmlBaseDir

function Normalize-NFNumber([string]$value) {
    $digits = ($value -replace '\D', '')
    $digits = $digits -replace '^0+', ''
    if ([string]::IsNullOrWhiteSpace($digits)) { return '0' }
    return $digits
}

function To-Number([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return 0 }
    $raw = $value.Trim()

    if ($raw.Contains(',') -and $raw.Contains('.')) {
        $raw = $raw.Replace('.', '').Replace(',', '.')
    } elseif ($raw.Contains(',')) {
        $raw = $raw.Replace(',', '.')
    }

    $raw = $raw -replace '[^0-9\.-]', ''

    $parsed = 0.0
    if ([double]::TryParse($raw, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
        return $parsed
    }

    return 0
}

function Get-InnerText($xmlDoc, [string]$xpath) {
    $node = $xmlDoc.SelectSingleNode($xpath)
    if ($null -eq $node) { return '' }
    return [string]$node.InnerText
}

function Get-NodeInnerText($node, [string]$xpath) {
    if ($null -eq $node) { return '' }
    $found = $node.SelectSingleNode($xpath)
    if ($null -eq $found) { return '' }
    return [string]$found.InnerText
}

function Build-NFData($xmlDoc, [string]$filePath) {
    $numeroNF = Normalize-NFNumber (Get-InnerText $xmlDoc "//*[local-name()='nNF']")
    $cliente = Get-InnerText $xmlDoc "//*[local-name()='dest']/*[local-name()='xNome']"
    if ([string]::IsNullOrWhiteSpace($cliente)) { $cliente = 'Cliente nao informado' }

    $transportadora = Get-InnerText $xmlDoc "//*[local-name()='transp']/*[local-name()='transporta']/*[local-name()='xNome']"
    if ([string]::IsNullOrWhiteSpace($transportadora)) { $transportadora = 'Nao informada' }

    $artigo = '-'
    $pedido = '-'
    $quantidadeItens = 0.0
    $metros = 0.0

    $detNodes = $xmlDoc.SelectNodes("//*[local-name()='det']")
    foreach ($det in $detNodes) {
        $prod = $det.SelectSingleNode("*[local-name()='prod']")
        if ($null -eq $prod) { continue }

        if ($artigo -eq '-') {
            $artigoValor = Get-NodeInnerText $prod "*[local-name()='xProd']"
            if (-not [string]::IsNullOrWhiteSpace($artigoValor)) {
                $artigo = $artigoValor
            }
        }

        if ($pedido -eq '-') {
            $pedidoValor = Get-NodeInnerText $prod "*[local-name()='xPed']"
            if ([string]::IsNullOrWhiteSpace($pedidoValor)) {
                $pedidoValor = Get-NodeInnerText $prod "*[local-name()='nPed']"
            }
            if (-not [string]::IsNullOrWhiteSpace($pedidoValor)) {
                $pedido = $pedidoValor
            }
        }

        $qCom = To-Number (Get-NodeInnerText $prod "*[local-name()='qCom']")
        $uCom = (Get-NodeInnerText $prod "*[local-name()='uCom']").ToUpperInvariant()

        $quantidadeItens += $qCom
        if ($uCom.Contains('M')) {
            $metros += $qCom
        }
    }

    if ($quantidadeItens -eq 0) {
        $qComNodes = $xmlDoc.SelectNodes("//*[local-name()='qCom']")
        foreach ($n in $qComNodes) {
            $quantidadeItens += To-Number ([string]$n.InnerText)
        }
    }

    if ($pedido -eq '-') {
        $pedidoXml = Get-InnerText $xmlDoc "//*[local-name()='xPed']"
        if ([string]::IsNullOrWhiteSpace($pedidoXml)) {
            $pedidoXml = Get-InnerText $xmlDoc "//*[local-name()='nPed']"
        }
        if (-not [string]::IsNullOrWhiteSpace($pedidoXml)) {
            $pedido = $pedidoXml
        }
    }

    $pesoBruto = 0.0
    $pesoNodes = $xmlDoc.SelectNodes("//*[local-name()='pesoB']")
    foreach ($n in $pesoNodes) {
        $pesoBruto += To-Number ([string]$n.InnerText)
    }

    if ($pesoBruto -eq 0) {
        $pesoBruto = To-Number (Get-InnerText $xmlDoc "//*[local-name()='ICMSTot']/*[local-name()='vProd']")
    }

    $valorTotal = To-Number (Get-InnerText $xmlDoc "//*[local-name()='ICMSTot']/*[local-name()='vNF']")

    $dataEmissaoRaw = Get-InnerText $xmlDoc "//*[local-name()='dhEmi']"
    if ([string]::IsNullOrWhiteSpace($dataEmissaoRaw)) {
        $dataEmissaoRaw = Get-InnerText $xmlDoc "//*[local-name()='dEmi']"
    }

    $dataEmissao = ''
    if (-not [string]::IsNullOrWhiteSpace($dataEmissaoRaw)) {
        if ($dataEmissaoRaw.Length -ge 10) {
            $dataEmissao = $dataEmissaoRaw.Substring(0, 10)
        } else {
            $dataEmissao = $dataEmissaoRaw
        }
    }

    return [ordered]@{
        encontrada = $true
        numeroNF = $numeroNF
        cliente = $cliente
        transportadora = $transportadora
        artigo = $artigo
        pedido = $pedido
        quantidadeItens = [math]::Round($quantidadeItens, 3)
        metros = [math]::Round($metros, 3)
        pesoBruto = [math]::Round($pesoBruto, 3)
        valorTotal = [math]::Round($valorTotal, 2)
        dataEmissao = $dataEmissao
        arquivo = $filePath
    }
}

function Find-NFInXmlFolder([string]$numeroProcurado) {
    $target = Normalize-NFNumber $numeroProcurado

    if (-not (Test-Path -LiteralPath $xmlBaseDir)) {
        return @{ erro = 'Diretorio de XML nao encontrado'; xmlBaseDir = $xmlBaseDir }
    }

    $xmlFiles = Get-ChildItem -LiteralPath $xmlBaseDir -Filter *.xml -Recurse -File -ErrorAction SilentlyContinue

    foreach ($file in $xmlFiles) {
        try {
            [xml]$doc = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        } catch {
            continue
        }

        $numeroXml = Normalize-NFNumber (Get-InnerText $doc "//*[local-name()='nNF']")
        if ($numeroXml -ne $target) { continue }

        return Build-NFData $doc $file.FullName
    }

    return $null
}

function Get-TransportadorasFromXmlFolder {
    if (-not (Test-Path -LiteralPath $xmlBaseDir)) {
        return @{ erro = 'Diretorio de XML nao encontrado'; xmlBaseDir = $xmlBaseDir }
    }

    $xmlFiles = Get-ChildItem -LiteralPath $xmlBaseDir -Filter *.xml -Recurse -File -ErrorAction SilentlyContinue
    $set = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($file in $xmlFiles) {
        try {
            [xml]$doc = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        } catch {
            continue
        }

        $nome = (Get-InnerText $doc "//*[local-name()='transp']/*[local-name()='transporta']/*[local-name()='xNome']").Trim()
        if (-not [string]::IsNullOrWhiteSpace($nome)) {
            [void]$set.Add($nome)
        }
    }

    $transportadoras = @($set | Sort-Object)

    return [ordered]@{
        ok = $true
        total = $transportadoras.Count
        transportadoras = $transportadoras
        xmlBaseDir = $xmlBaseDir
    }
}

function Write-JsonResponse($context, [int]$statusCode, $payload) {
    $response = $context.Response
    $response.StatusCode = $statusCode
    $response.ContentType = 'application/json; charset=utf-8'
    $response.Headers['Access-Control-Allow-Origin'] = '*'
    $response.Headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    $response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'

    $json = $payload | ConvertTo-Json -Depth 8
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.OutputStream.Close()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host "[NF XML API PS] Rodando em http://127.0.0.1:$port"
Write-Host "[NF XML API PS] Pasta base: $xmlBaseDir"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $path = $request.Url.AbsolutePath

    if ($request.HttpMethod -eq 'OPTIONS') {
        $context.Response.StatusCode = 204
        $context.Response.Headers['Access-Control-Allow-Origin'] = '*'
        $context.Response.Headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
        $context.Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
        $context.Response.OutputStream.Close()
        continue
    }

    if ($request.HttpMethod -eq 'GET' -and $path -eq '/api/health') {
        Write-JsonResponse $context 200 ([ordered]@{
            ok = $true
            xmlBaseDir = $xmlBaseDir
            xmlBaseDirExists = (Test-Path -LiteralPath $xmlBaseDir)
            timestamp = [DateTime]::Now.ToString('s')
            server = 'powershell'
        })
        continue
    }

    if ($request.HttpMethod -eq 'GET' -and $path -eq '/api/transportadoras') {
        $resultado = Get-TransportadorasFromXmlFolder

        if ($resultado -and $resultado.erro) {
            Write-JsonResponse $context 500 $resultado
            continue
        }

        Write-JsonResponse $context 200 $resultado
        continue
    }

    if ($request.HttpMethod -eq 'GET' -and $path.StartsWith('/api/nf/')) {
        $numero = [System.Uri]::UnescapeDataString($path.Substring('/api/nf/'.Length)).Trim()
        if ([string]::IsNullOrWhiteSpace($numero)) {
            Write-JsonResponse $context 400 @{ error = 'Numero da NF nao informado' }
            continue
        }

        $resultado = Find-NFInXmlFolder $numero

        if ($resultado -and $resultado.erro) {
            Write-JsonResponse $context 500 $resultado
            continue
        }

        if ($null -eq $resultado) {
            Write-JsonResponse $context 404 @{ encontrada = $false; numeroProcurado = (Normalize-NFNumber $numero) }
            continue
        }

        Write-JsonResponse $context 200 $resultado
        continue
    }

    Write-JsonResponse $context 404 @{ error = 'Rota nao encontrada' }
}
