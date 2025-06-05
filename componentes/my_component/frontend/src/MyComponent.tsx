import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib"
import React, { useEffect } from "react"
import { ButtonRenderer } from './ButtonRenderer';
import { NavbarRenderer } from './NavbarRenderer';

// Não precisamos mais das interfaces combinadas aqui se acessarmos diretamente

function MyComponent(props: ComponentProps): React.ReactElement {
  useEffect(() => {
    Streamlit.setFrameHeight()
  })

  // Acessa o objeto args diretamente das props
  const args = props.args;

  // Validação inicial
  if (!args || typeof args !== "object" || typeof args.tipo !== 'string' || !args.tipo) {
    console.error("Argumentos inválidos ou sem 'tipo' string não vazia recebidos. Props:", props)
    return <div>Erro: Argumentos inválidos recebidos do Python.</div>
  }

  const tipo = args.tipo;

  // Renderização Condicional
  switch (tipo) {
    case "botao": {
      // Extrai diretamente de args
      const texto = args.texto;
      const valor_retorno = args.valor_retorno;
      // Validação específica para botão
      if (typeof texto !== 'string') {
         console.error("MyComponent: Botao args inválidos: 'texto' não é string.", args)
         return <div>Erro: 'texto' do botão deve ser uma string.</div>
      }
      return <ButtonRenderer texto={texto} valor_retorno={valor_retorno} />;
    }
    case "navbar": {
      // Extrai as props necessárias de args (ou pythonArgs, dependendo da versão)
      const opcoes = args.opcoes;
      const icons = args.icons;
      const selected = args.selected;
      const user_name = args.user_name;
      const seletor_opcoes = args.seletor_opcoes;

      // Validação específica para navbar (pode ser feita aqui ou no NavbarRenderer)
      if (!Array.isArray(opcoes)) {
         console.error("MyComponent: Navbar args inválidos: 'opcoes' não é um array.", args)
         return <div>Erro: 'opcoes' da navbar deve ser um array.</div>
      }

      // Renderiza o componente NavbarRenderer passando as props
      return <NavbarRenderer 
                items={opcoes} 
                icons={icons} 
                selected={selected} 
                user_name={user_name}
                seletor_opcoes = {seletor_opcoes} 
             />;
    }
    default: {
      const unknownType = args.tipo || "desconhecido";
      console.warn("Tipo de componente não reconhecido:", unknownType)
      return <div>Tipo de componente desconhecido: {String(unknownType)}</div>
    }
  }
}

export default withStreamlitConnection(MyComponent)

