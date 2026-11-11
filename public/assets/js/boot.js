/* Executa antes de tudo: marca que o JavaScript está ativo e, na visualização local (arquivo aberto
   direto do disco), carrega as fontes embutidas, porque os navegadores bloqueiam fontes em file://. */
document.documentElement.classList.add('js');
if (location.protocol === 'file:') {
  var s = document.currentScript, l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = s.src.replace(/js\/boot\.js.*$/, 'css/fonts-inline.css');
  document.head.appendChild(l);
}
