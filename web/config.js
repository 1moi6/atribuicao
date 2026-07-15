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
  endpoint: "https://script.google.com/macros/s/AKfycbyFt0ucs1XOjnwGDKbXVWQNGmx5FGui6nh8syaSzKXLFcNWUahe1luSkO_KEwS5c-uV/exec",
  clientId: "23226739408-vs77ncdednf9vh3ijjemf9s6vfc1ub1c.apps.googleusercontent.com",
};
