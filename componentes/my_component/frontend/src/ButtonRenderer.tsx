import React, { useCallback, useState } from 'react'; // Importa useState
import { Streamlit } from 'streamlit-component-lib';

// Interface para as props (não precisa mudar)
interface ButtonRendererProps {
  texto: string;
  // valor_retorno não é mais usado para o valor retornado, mas pode ser mantido para outros fins se necessário
  valor_retorno?: any; 
}

export function ButtonRenderer({ texto }: ButtonRendererProps): React.ReactElement {
  // --- HOOKS NO TOPO ---
  // Adiciona estado para contar os cliques, inicializado em 0
  const [clickCount, setClickCount] = useState<number>(0);

  // Callback para o clique
  const handleClick = useCallback(() => {
    // Calcula o próximo valor do contador
    const nextCount = clickCount + 1;
    // Atualiza o estado local
    setClickCount(nextCount);
    // Envia o *novo* contador para o Streamlit
    Streamlit.setComponentValue(nextCount);
  }, [clickCount]); // Dependência: clickCount
  // --- FIM DOS HOOKS ---

  // Renderiza o botão
  return (
    <button
      className="btn btn-primary"
      onClick={handleClick}
    >
      {/* Opcional: Mostrar o contador no botão */} 
      {/* {texto} ({clickCount}) */}
      {texto}
    </button>
  );
}
