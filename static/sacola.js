/* ============================================================
   SACOLA (🛍)

   Como funciona:
   1) "Adicionar à sacola" guarda o livro no navegador (localStorage),
      SEM sair da página: a pessoa continua lendo sobre o livro e o autor;
   2) o ícone no canto superior direito mostra quantos itens há;
   3) clicar no ícone abre o painel lateral com os itens, a quantidade
      (− 1 +), a lixeira, o subtotal e o botão "Finalizar compra".

   O que fica guardado é só { id do produto, quantidade }.
   O PREÇO cobrado nunca sai daqui: o servidor recalcula tudo no fim.
   ============================================================ */
(function () {
    'use strict';
    var CHAVE = 'sacolaDoZero';          // nome da "gaveta" no localStorage
    var painel = document.getElementById('sacola');

    /* ---------- guardar e ler a sacola ---------- */
    function ler() {
        try {
            var dados = JSON.parse(localStorage.getItem(CHAVE) || '{}');
            return Array.isArray(dados.itens) ? dados.itens : [];
        } catch (e) { return []; }      // navegador sem memória ou dado estragado: sacola vazia
    }
    function salvar(itens) {
        try { localStorage.setItem(CHAVE, JSON.stringify({ itens: itens })); } catch (e) { /* sem memória */ }
    }
    function quantidade() {
        return ler().reduce(function (soma, item) { return soma + (item.qtd || 0); }, 0);
    }
    function limpar() { salvar([]); }

    /* o checkout (outra página) também usa estas funções */
    window.Sacola = { ler: ler, quantidade: quantidade, limpar: limpar };

    /* volta do Mercado Pago com pagamento aprovado: a compra acabou, esvazia a sacola */
    if (/[?&]pagamento=aprovado/.test(window.location.search)) { limpar(); }

    if (!painel) { return; }             // página sem painel (ex.: checkout): só as funções acima

    var botao = document.getElementById('sacolaBotao');
    var contador = document.getElementById('sacolaContador');
    var fundo = document.getElementById('sacolaFundo');
    var fechar = document.getElementById('sacolaFechar');
    var lista = document.getElementById('sacolaItens');
    var vazia = document.getElementById('sacolaVazia');
    var rodape = document.getElementById('sacolaRodape');
    var raiz = document.documentElement;
    var aberta = false;

    // informações do livro vindas do HTML (data-...)
    var produto = {
        titulo: painel.getAttribute('data-titulo'),
        formato: painel.getAttribute('data-formato'),
        preco: parseFloat(painel.getAttribute('data-preco')) || 0,
        foto: painel.getAttribute('data-foto'),
        max: parseInt(painel.getAttribute('data-max'), 10) || 10
    };

    function brl(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

    /* ---------- mudar a quantidade ---------- */
    function mudar(id, novaQtd) {
        var itens = ler();
        novaQtd = Math.max(0, Math.min(produto.max, novaQtd));
        var item = itens.filter(function (i) { return i.id === id; })[0];
        if (item) { item.qtd = novaQtd; } else if (novaQtd > 0) { itens.push({ id: id, qtd: novaQtd }); }
        salvar(itens.filter(function (i) { return i.qtd > 0; }));   // quantidade 0 = sai da sacola
        desenhar();
    }

    function adicionar(id) {
        var atual = ler().filter(function (i) { return i.id === id; })[0];
        mudar(id, (atual ? atual.qtd : 0) + 1);
        // "pulinho" no ícone para mostrar que entrou
        botao.classList.remove('pulou'); void botao.offsetWidth; botao.classList.add('pulou');
        abrir();
    }

    /* ---------- desenhar a sacola ---------- */
    function criar(tag, classe, texto) {
        var el = document.createElement(tag);
        if (classe) { el.className = classe; }
        if (texto !== undefined) { el.textContent = texto; }
        return el;
    }

    function desenhar() {
        var itens = ler();
        var total = quantidade();

        // ícone: bolinha com o número (some quando está vazia)
        contador.textContent = total;
        contador.hidden = total === 0;
        botao.setAttribute('aria-label', total ? 'Abrir sacola (' + total + (total === 1 ? ' item)' : ' itens)') : 'Abrir sacola');

        lista.innerHTML = '';
        vazia.hidden = total > 0;
        rodape.hidden = total === 0;
        var subtotal = 0;

        itens.forEach(function (item) {
            subtotal += produto.preco * item.qtd;
            var linha = criar('div', 'sacola-item');

            var foto;
            if (produto.foto) {
                foto = criar('img', 'sacola-foto');
                foto.src = produto.foto; foto.alt = ''; foto.width = 84; foto.height = 105;
            } else {
                foto = criar('div', 'sacola-foto sacola-foto-vazia', produto.titulo.slice(0, 1));
            }

            var info = criar('div', 'sacola-info');
            info.appendChild(criar('p', 'sacola-nome', produto.titulo));
            info.appendChild(criar('p', 'sacola-detalhe', produto.formato));
            info.appendChild(criar('p', 'sacola-preco', brl(produto.preco * item.qtd)));

            // controle − 1 +
            var qtd = criar('div', 'sacola-qtd');
            var menos = criar('button', '', '−');
            menos.type = 'button'; menos.setAttribute('aria-label', 'Diminuir quantidade');
            menos.disabled = item.qtd <= 1;
            menos.addEventListener('click', function () { mudar(item.id, item.qtd - 1); });
            var numero = criar('span', '', String(item.qtd));
            numero.setAttribute('aria-label', 'Quantidade: ' + item.qtd);
            var mais = criar('button', '', '+');
            mais.type = 'button'; mais.setAttribute('aria-label', 'Aumentar quantidade');
            mais.disabled = item.qtd >= produto.max;
            mais.addEventListener('click', function () { mudar(item.id, item.qtd + 1); });
            qtd.appendChild(menos); qtd.appendChild(numero); qtd.appendChild(mais);
            info.appendChild(qtd);

            // lixeira
            var lixo = criar('button', 'sacola-lixo');
            lixo.type = 'button'; lixo.setAttribute('aria-label', 'Remover da sacola');
            lixo.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            lixo.addEventListener('click', function () { mudar(item.id, 0); });

            linha.appendChild(foto); linha.appendChild(info); linha.appendChild(lixo);
            lista.appendChild(linha);
        });

        document.getElementById('sacolaSubtotal').textContent = brl(subtotal);
    }

    /* ---------- abrir e fechar (igual ao menu ☰) ---------- */
    function focaveis() {
        return Array.prototype.slice.call(painel.querySelectorAll('a[href], button:not([disabled])'))
            .filter(function (el) { return el.offsetParent !== null; });
    }
    function abrir() {
        aberta = true;
        raiz.classList.add('sacola-aberta');
        botao.setAttribute('aria-expanded', 'true');
        painel.setAttribute('role', 'dialog');
        painel.setAttribute('aria-modal', 'true');
        window.setTimeout(function () { fechar.focus(); }, 30);
    }
    function fecharSacola(devolverFoco) {
        aberta = false;
        raiz.classList.remove('sacola-aberta');
        botao.setAttribute('aria-expanded', 'false');
        painel.removeAttribute('role');
        painel.removeAttribute('aria-modal');
        if (devolverFoco !== false) { botao.focus(); }
    }

    botao.addEventListener('click', function () { if (aberta) { fecharSacola(); } else { abrir(); } });
    fechar.addEventListener('click', function () { fecharSacola(); });
    fundo.addEventListener('click', function () { fecharSacola(); });
    document.getElementById('sacolaContinuar').addEventListener('click', function () { fecharSacola(); });
    document.getElementById('sacolaExplorar').addEventListener('click', function () { fecharSacola(); });

    document.addEventListener('keydown', function (e) {
        if (!aberta) { return; }
        if (e.key === 'Escape') { fecharSacola(); return; }
        if (e.key === 'Tab') {               // o Tab fica preso dentro da sacola aberta
            var l = focaveis();
            if (!l.length) { return; }
            if (e.shiftKey && document.activeElement === l[0]) { e.preventDefault(); l[l.length - 1].focus(); }
            else if (!e.shiftKey && document.activeElement === l[l.length - 1]) { e.preventDefault(); l[0].focus(); }
        }
    });

    /* qualquer botão com data-sacola-adicionar="livro" coloca o livro na sacola */
    document.addEventListener('click', function (e) {
        var alvo = e.target.closest ? e.target.closest('[data-sacola-adicionar]') : null;
        if (!alvo) { return; }
        e.preventDefault();
        adicionar(alvo.getAttribute('data-sacola-adicionar'));
    });

    /* outra aba mudou a sacola? atualiza esta também */
    window.addEventListener('storage', function (e) { if (e.key === CHAVE) { desenhar(); } });
    /* voltar pelo botão "Voltar" do navegador: redesenha (a sacola pode ter mudado) e fecha */
    window.addEventListener('pageshow', function () { desenhar(); if (aberta) { fecharSacola(false); } });

    desenhar();
})();
