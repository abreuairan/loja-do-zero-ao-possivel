/* ============================================================
   LOJA - pequenos efeitos de experiência

   1) as seções "sobem" e aparecem quando você rola até elas;
   2) a barra "Comprar" (celular) aparece depois da capa e some
      quando a seção de compra está na tela.
   Sem JavaScript o site funciona igual, só sem esses efeitos.
   ============================================================ */
(function () {
    'use strict';
    var reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 1) aparecer ao rolar */
    var alvos = document.querySelectorAll('.secao-miolo, .destaque, .compra');
    if ('IntersectionObserver' in window && !reduz) {
        alvos.forEach(function (el) { el.classList.add('revelar'); });
        var obs = new IntersectionObserver(function (itens) {
            itens.forEach(function (i) {
                if (i.isIntersecting) { i.target.classList.add('visivel'); obs.unobserve(i.target); }
            });
        }, { threshold: 0.12 });
        alvos.forEach(function (el) { obs.observe(el); });
    }

    /* 2) barra de compra */
    var barra = document.getElementById('barraCompra');
    var capa = document.getElementById('inicio');
    var comprar = document.getElementById('comprar');
    if (!barra || !capa || !comprar || !('IntersectionObserver' in window)) { return; }

    var capaVisivel = true, comprarVisivel = false;
    function atualizar() {
        var mostrar = !capaVisivel && !comprarVisivel;
        barra.classList.toggle('aberta', mostrar);
        barra.setAttribute('aria-hidden', mostrar ? 'false' : 'true');
        barra.querySelector('a, button').tabIndex = mostrar ? 0 : -1;   // link ou botão da sacola
    }
    new IntersectionObserver(function (i) { capaVisivel = i[0].isIntersecting; atualizar(); }, { threshold: 0.5 }).observe(capa);
    new IntersectionObserver(function (i) { comprarVisivel = i[0].isIntersecting; atualizar(); }, { threshold: 0.2 }).observe(comprar);
})();

/* ============================================================
   CARROSSEL DE FOTOS (seção "Comprar")

   O deslize em si é feito pelo navegador (CSS scroll-snap): no celular
   é só arrastar com o dedo. Este código só cuida de:
   - botões ‹ › e bolinhas;
   - marcar qual foto está na tela;
   - troca automática (pausa quando você mexe, passa o mouse ou foca).
   ============================================================ */
(function () {
    'use strict';
    var raiz = document.getElementById('carrossel');
    if (!raiz) { return; }

    var pista = document.getElementById('carPista');
    var slides = pista.children;
    var pontos = document.querySelectorAll('#carPontos button');
    var total = slides.length;
    var atual = 0;
    var reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var segundos = parseInt(raiz.getAttribute('data-segundos'), 10) || 0;
    var timer = null, parado = false, visivel = false;

    function marcar(i) {
        atual = i;
        pontos.forEach(function (p, n) {
            if (n === i) { p.setAttribute('aria-current', 'true'); } else { p.removeAttribute('aria-current'); }
        });
    }

    function ir(i) {
        i = (i + total) % total;
        pista.scrollTo({ left: i * pista.clientWidth, behavior: reduz ? 'auto' : 'smooth' });
        marcar(i);
    }

    /* quando o dedo/mouse/scroll move a pista, descobre qual foto ficou no centro */
    var esperando = false;
    pista.addEventListener('scroll', function () {
        if (esperando) { return; }
        esperando = true;
        window.requestAnimationFrame(function () {
            esperando = false;
            var i = Math.round(pista.scrollLeft / pista.clientWidth);
            if (i !== atual && i >= 0 && i < total) { marcar(i); }
        });
    }, { passive: true });

    document.getElementById('carAnt').addEventListener('click', function () { ir(atual - 1); parar(); });
    document.getElementById('carProx').addEventListener('click', function () { ir(atual + 1); parar(); });
    pontos.forEach(function (p, n) { p.addEventListener('click', function () { ir(n); parar(); }); });
    pista.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); ir(atual - 1); parar(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); ir(atual + 1); parar(); }
    });

    /* se a janela mudar de tamanho, mantém a foto atual enquadrada */
    window.addEventListener('resize', function () { pista.scrollTo({ left: atual * pista.clientWidth, behavior: 'auto' }); });

    /* ---- troca automática (só se não houver preferência por menos movimento) ---- */
    function ligar() {
        if (timer || !segundos || reduz || parado || !visivel) { return; }
        timer = window.setInterval(function () { ir(atual + 1); }, segundos * 1000);
    }
    function desligar() { if (timer) { window.clearInterval(timer); timer = null; } }
    function parar() { parado = true; desligar(); }              // a pessoa assumiu o controle: para de vez

    raiz.addEventListener('mouseenter', desligar);
    raiz.addEventListener('mouseleave', function () { if (!parado) { ligar(); } });
    raiz.addEventListener('focusin', desligar);
    raiz.addEventListener('touchstart', parar, { passive: true });
    pista.addEventListener('pointerdown', parar);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (i) {
            visivel = i[0].isIntersecting;
            if (visivel) { ligar(); } else { desligar(); }
        }, { threshold: 0.5 }).observe(raiz);
    }
})();

/* ============================================================
   FRETE (seção "Comprar")

   1) o cliente digita o CEP (a máscara coloca o traço sozinha);
   2) o site pergunta ao servidor (/frete), que consulta o Melhor Envio;
   3) as opções aparecem como "pílulas" para escolher;
   4) o total (livro + frete) é atualizado.
   A chave do Melhor Envio NUNCA passa por aqui: fica só no servidor.
   ============================================================ */
(function () {
    'use strict';
    var caixa = document.getElementById('frete');
    if (!caixa) { return; }

    var form = document.getElementById('freteForm');
    var campo = document.getElementById('cep');
    var botao = document.getElementById('freteBotao');
    var msg = document.getElementById('freteMsg');
    var lista = document.getElementById('freteOpcoes');
    var total = document.getElementById('freteTotal');
    // o preço é lido na hora (e não guardado)
    function precoLivro() { return parseFloat(caixa.getAttribute('data-preco')) || 0; }
    // guarda a escolha atual (CEP + opção), para o pagamento com desconto usar
    window.freteEscolhido = null;
    var url = caixa.getAttribute('data-url');

    function brl(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

    function aviso(texto, erro) {
        msg.textContent = texto || '';
        msg.className = 'frete-msg' + (erro ? ' erro' : '');
        campo.setAttribute('aria-invalid', erro ? 'true' : 'false');
    }

    function limpar() { lista.innerHTML = ''; total.hidden = true; window.freteEscolhido = null; }

    function atualizarTotal(valorFrete) {
        document.getElementById('totLivro').textContent = brl(precoLivro());
        document.getElementById('totFrete').textContent = brl(valorFrete);
        document.getElementById('totTotal').textContent = brl(precoLivro() + valorFrete);
        total.hidden = false;
    }
    // chamada quando o preço do livro muda
    window.recalcularTotal = function () {
        var marcado = lista.querySelector('input[name="frete"]:checked');
        if (marcado) { atualizarTotal(parseFloat(marcado.value)); }
    };

    function mostrar(opcoes) {
        limpar();
        opcoes.forEach(function (o, n) {
            var rotulo = document.createElement('label');
            rotulo.className = 'frete-opcao';
            rotulo.style.animationDelay = (n * 0.06) + 's';

            var radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'frete'; radio.value = o.preco;
            radio.addEventListener('change', function () {
                window.freteEscolhido = { cep: campo.value.replace(/\D/g, ''), id: o.id };
                atualizarTotal(o.preco);
            });

            var nome = document.createElement('span');
            nome.className = 'frete-nome';
            nome.textContent = (o.empresa ? o.empresa + ' ' : '') + o.nome;
            if (o.prazo) {
                var prazo = document.createElement('small');
                prazo.textContent = 'Chega em até ' + o.prazo + (o.prazo === 1 ? ' dia útil' : ' dias úteis');
                nome.appendChild(prazo);
            }

            var valor = document.createElement('span');
            valor.className = 'frete-valor';
            valor.textContent = brl(o.preco);

            rotulo.appendChild(radio); rotulo.appendChild(nome); rotulo.appendChild(valor);
            lista.appendChild(rotulo);
            if (n === 0) {   // a mais barata já vem marcada
                radio.checked = true;
                window.freteEscolhido = { cep: campo.value.replace(/\D/g, ''), id: o.id };
                atualizarTotal(o.preco);
            }
        });
    }

    /* máscara: 12345678 vira 12345-678 */
    campo.addEventListener('input', function () {
        var n = campo.value.replace(/\D/g, '').slice(0, 8);
        campo.value = n.length > 5 ? n.slice(0, 5) + '-' + n.slice(5) : n;
        if (msg.textContent) { aviso(''); }
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var cep = campo.value.replace(/\D/g, '');
        if (cep.length !== 8) { limpar(); aviso('Digite um CEP com 8 números.', true); campo.focus(); return; }

        botao.disabled = true; botao.textContent = 'Calculando…';
        aviso('Consultando as opções de entrega…'); limpar();

        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cep: cep }) })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
                if (!res.ok) { aviso(res.d.erro || 'Não foi possível calcular o frete.', true); return; }
                aviso('Escolha como prefere receber:');
                mostrar(res.d.opcoes);
                // aproveita o CEP no formulário de entrega (se ainda estiver vazio)
                var cepEntrega = document.getElementById('entregaCep');
                if (cepEntrega && !cepEntrega.value) {
                    cepEntrega.value = campo.value;
                    cepEntrega.dispatchEvent(new Event('change'));
                }
            })
            .catch(function () { aviso('Sem conexão. Tente novamente.', true); })
            .then(function () { botao.disabled = false; botao.textContent = 'Calcular'; });
    });
})();


/* (os DADOS PARA ENTREGA saíram daqui: agora ficam na página Finalizar compra, em checkout.js) */


/* ============================================================
   AVISO DO PRESENTE (canto da tela)

   ONDE aparece: enquanto a pessoa lê "Sobre o livro" e "Sobre o autor".
   ONDE NÃO aparece: na capa, na parte de compra (lá já existe o cartão 10% OFF)
   e na seção final da pesquisa (que já é um convite ao questionário).
   Se a pessoa fechar ou clicar, o navegador guarda isso e ele não volta.
   ============================================================ */
(function () {
    'use strict';
    var aviso = document.getElementById('avisoCupom');
    if (!aviso || !('IntersectionObserver' in window)) { return; }

    var PERMITIDAS = ['sobre', 'autor'];                 // seções onde o aviso pode aparecer
    var PROIBIDAS = ['inicio', 'comprar', 'pesquisa'];   // seções onde ele some
    var CHAVE = 'avisoCupomVisto';
    var visiveis = {};          // quais seções estão na tela agora
    var espera = null;          // pequeno atraso antes de mostrar

    function jaViu() { try { return localStorage.getItem(CHAVE) === '1'; } catch (e) { return false; } }
    function marcarVisto() { try { localStorage.setItem(CHAVE, '1'); } catch (e) { /* sem memória: tudo bem */ } }
    function esconder() { clearTimeout(espera); aviso.hidden = true; }
    
    if (jaViu()) { return; }

    // decide, a cada rolagem, se o aviso deve estar aberto ou fechado
    function decidir() {
        if (jaViu()) { esconder(); return; }
        var proibidaNaTela = PROIBIDAS.some(function (id) { return visiveis[id]; });
        var permitidaNaTela = PERMITIDAS.some(function (id) { return visiveis[id]; });
        if (proibidaNaTela || !permitidaNaTela) { esconder(); return; }   // a proibida sempre vence
        if (aviso.hidden && !espera) {
            espera = setTimeout(function () { espera = null; aviso.hidden = false; }, 1000);
        }
    }

    // "observador": avisa quando cada seção entra ou sai da tela (pelo menos 35% dela)
    var observador = new IntersectionObserver(function (itens) {
        itens.forEach(function (item) { visiveis[item.target.id] = item.isIntersecting; });
        decidir();
    }, { threshold: 0.35 });
    PERMITIDAS.concat(PROIBIDAS).forEach(function (id) {
        var secao = document.getElementById(id);
        if (secao) { observador.observe(secao); }
    });

    document.getElementById('avisoFechar').addEventListener('click', function () { esconder(); marcarVisto(); });
    document.getElementById('avisoLink').addEventListener('click', function () { esconder(); marcarVisto(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !aviso.hidden) { esconder(); marcarVisto(); } });
})();
