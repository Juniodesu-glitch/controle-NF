import React, { useState } from "react";

interface BipagemNFProps {
  onAddNF: (nf: string) => void;
  nfs: string[];
}

const BipagemNF: React.FC<BipagemNFProps> = ({ onAddNF, nfs }) => {
  const [input, setInput] = useState("");

  const extractNumeroNF = (chave: string) => {
    if (chave.length === 44) {
      return chave.slice(25, 34);
    }
    return "";
  };

  const handleAdd = () => {
    if (input.length === 44 && !nfs.includes(input)) {
      onAddNF(input);
      setInput("");
    }
  };

  return (
    <div className="bipagem-nf-panel">
      <h2>Bipagem Manual de NF</h2>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value.replace(/\D/g, ""))}
        maxLength={44}
        placeholder="Bipe ou digite os 44 dígitos da NF"
        className="input-nf"
      />
      <button onClick={handleAdd} disabled={input.length !== 44}>
        Adicionar NF
      </button>
      <div className="lista-nfs">
        <h3>Notas bipadas:</h3>
        <ul>
          {nfs.map((nf, idx) => (
            <li key={idx}>
              <strong>{extractNumeroNF(nf) || "NF inválida"}</strong> — {nf}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BipagemNF;
