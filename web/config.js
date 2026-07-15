/*
 * config.js — configuração embutida no deploy (não é segredo).
 *
 * Preencha uma vez e faça o commit: assim qualquer pessoa que abrir o site já
 * carrega os dados (leitura pública) sem precisar configurar nada. O editor só
 * precisa fazer login. O ⚙ do app sobrescreve estes valores neste navegador.
 *
 *  - endpoint: URL /exec do Web App do Apps Script.
 *  - clientId: Client ID do OAuth (…apps.googleusercontent.com), usado no login.
 *
 * Nenhum dos dois é segredo: o Client ID é público por natureza e a escrita é
 * protegida pelo login Google verificado no servidor (Apps Script).
 */
window.APP_CONFIG = {
  endpoint: "",
  clientId: "",
};
