/* ============================================================
   FINALIZAR COMPRA - 3 etapas

   1) DADOS DE ENVIO   → o CEP preenche o endereço sozinho (ViaCEP)
   2) FORMA DE ENVIO   → o servidor (/frete) pergunta ao Melhor Envio: PAC ou SEDEX
   3) PAGAMENTO        → o servidor (/pedido) registra o pedido e:
        - Pix: devolve o QR Code e o copia e cola, que mostramos aqui mesmo,
          e de 5 em 5 segundos perguntamos (/pix/situacao) se já foi pago;
        - Cartão: devolve o link do Mercado Pago e levamos a pessoa até lá.

   Do navegador vão só: a QUANTIDADE, o endereço, a opção de frete e a forma
   de pagamento. Os VALORES são sempre calculados pelo servidor.
   ============================================================ */
(function () {
    'use strict';
    var raiz = document.getElementById('checkout');
    if (!raiz || !window.Sacola) { return; }

    function $(id) { return document.getElementById(id); }
    function brl(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function dado(nome) { return raiz.getAttribute('data-' + nome); }

    var preco = parseFloat(dado('preco')) || 0;
    var max = parseInt(dado('max'), 10) || 10;

    // quantos livros há na sacola (o servidor confere de novo)
    var quantidade = window.Sacola.ler()
        .filter(function (i) { return i.id === 'livro'; })
        .reduce(function (s, i) { return s + (i.qtd || 0); }, 0);
    quantidade = Math.min(quantidade, max);

    if (!quantidade) {                 // sacola vazia: nada a finalizar
        $('ckVazio').hidden = false;
        $('ckGrade').hidden = true;
        $('ckPassos').hidden = true;
        return;
    }

    /* o que a pessoa já escolheu */
    var envio = null;                  // dados da etapa 1
    var frete = null;                  // { id, preco, nome } da etapa 2
    var pix = null;                    // { pedido, pagamento_id, ... } depois de gerar o Pix
    var travado = false;               // depois de gerar o Pix, as etapas 1 e 2 não mudam mais

    /* ---------- RESUMO (coluna da direita) ---------- */
    function desenharResumo() {
        var caixa = $('resumoItens');
        caixa.innerHTML = '';
        var linha = document.createElement('div');
        linha.className = 'ck-item';
        if (dado('foto')) {
            var img = document.createElement('img');
            img.src = dado('foto'); img.alt = ''; img.width = 56; img.height = 70;
            linha.appendChild(img);
        }
        var nome = document.createElement('p');
        nome.innerHTML = '<strong></strong><small></small>';
        nome.querySelector('strong').textContent = dado('titulo');
        nome.querySelector('small').textContent = quantidade + (quantidade === 1 ? ' unidade' : ' unidades') + ' · ' + brl(preco) + ' cada';
        linha.appendChild(nome);
        var valor = document.createElement('span');
        valor.textContent = brl(preco * quantidade);
        linha.appendChild(valor);
        caixa.appendChild(linha);

        var subtotal = preco * quantidade;
        $('resSubtotal').textContent = brl(subtotal);
        $('resFrete').textContent = frete ? brl(frete.preco) : 'a calcular';
        $('resTotal').textContent = brl(subtotal + (frete ? frete.preco : 0));
    }

    /* ---------- abrir/fechar etapas ---------- */
    function irPara(n) {
        [1, 2, 3].forEach(function (i) {
            var etapa = $('etapa' + i);
            var aberta = i === n;
            etapa.classList.toggle('aberta', aberta);
            etapa.classList.toggle('feita', i < n);
            etapa.querySelector('.ck-corpo').hidden = !aberta;
            var resumo = $('resumo' + i);
            if (resumo) { resumo.hidden = !(i < n); }
            var editar = etapa.querySelector('.ck-editar');
            if (editar) { editar.hidden = !(i < n) || travado; }
        });
        Array.prototype.forEach.call($('ckPassos').children, function (li) {
            var p = parseInt(li.getAttribute('data-passo'), 10);
            li.className = p === n ? 'atual' : (p < n ? 'feito' : '');
        });
        var alvo = $('etapa' + n);
        var suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.setTimeout(function () { alvo.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' }); }, 50);
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-editar]'), function (b) {
        b.addEventListener('click', function () { if (!travado) { irPara(parseInt(b.getAttribute('data-editar'), 10)); } });
    });

    function aviso(id, texto, tipo) {
        var el = $(id);
        el.textContent = texto || '';
        el.className = (id === 'msg2' ? 'frete-msg' : 'cupom-msg') + (tipo ? ' ' + tipo : '');
    }

    /* ============ ETAPA 1: DADOS DE ENVIO ============ */
    var form = $('formEnvio');
    var cep = $('ckCep');
    var campo = function (nome) { return form.elements[nome]; };
    var CAMPOS = ['nome', 'email', 'telefone', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];

    // se a pessoa recarregar a página, os dados continuam (só nesta aba: sessionStorage)
    try {
        var salvos = JSON.parse(sessionStorage.getItem('ckEnvio') || 'null');
        if (salvos) { CAMPOS.forEach(function (n) { if (salvos[n]) { campo(n).value = salvos[n]; } }); }
    } catch (e) { /* sem memória: tudo bem */ }

    function buscarEndereco() {
        var n = cep.value.replace(/\D/g, '');
        if (n.length !== 8) { return; }
        fetch('https://viacep.com.br/ws/' + n + '/json/')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.erro) { aviso('msg1', 'CEP não encontrado. Confira ou preencha o endereço à mão.', 'erro'); return; }
                if (d.logradouro) { campo('rua').value = d.logradouro; }
                if (d.bairro) { campo('bairro').value = d.bairro; }
                campo('cidade').value = d.localidade || campo('cidade').value;
                campo('uf').value = d.uf || campo('uf').value;
                aviso('msg1', '');
                campo(d.logradouro ? 'numero' : 'rua').focus();     // pula para o que falta
            })
            .catch(function () { /* sem ViaCEP: a pessoa preenche à mão */ });
    }
    cep.addEventListener('input', function () {
        var n = cep.value.replace(/\D/g, '').slice(0, 8);
        cep.value = n.length > 5 ? n.slice(0, 5) + '-' + n.slice(5) : n;
        if (n.length === 8) { buscarEndereco(); }
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        // 1) obrigatórios preenchidos?
        var faltando = null;
        Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
            var vazio = !el.value.trim();
            el.setAttribute('aria-invalid', vazio ? 'true' : 'false');
            if (vazio && !faltando) { faltando = el; }
        });
        if (faltando) { aviso('msg1', 'Preencha os campos destacados.', 'erro'); faltando.focus(); return; }
        // 2) formatos (o servidor confere tudo de novo)
        var d = {};
        CAMPOS.forEach(function (n) { d[n] = campo(n).value.trim(); });
        var problema = null;
        if (d.nome.split(/\s+/).length < 2) { problema = ['nome', 'Digite seu nome completo.']; }
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) { problema = ['email', 'Confira o e-mail.']; }
        else if ([10, 11].indexOf(d.telefone.replace(/\D/g, '').length) < 0) { problema = ['telefone', 'Digite o WhatsApp com DDD (ex.: 43 91234-5678).']; }
        else if (d.cep.replace(/\D/g, '').length !== 8) { problema = ['cep', 'O CEP precisa ter 8 números.']; }
        else if (!/^[A-Za-z]{2}$/.test(d.uf)) { problema = ['uf', 'Confira a sigla do estado (ex.: PR).']; }
        if (problema) {
            campo(problema[0]).setAttribute('aria-invalid', 'true');
            aviso('msg1', problema[1], 'erro'); campo(problema[0]).focus(); return;
        }
        d.uf = d.uf.toUpperCase();
        aviso('msg1', '');
        try { sessionStorage.setItem('ckEnvio', JSON.stringify(d)); } catch (err) { /* ok */ }

        // CEP mudou? o frete precisa ser calculado de novo
        if (!envio || envio.cep.replace(/\D/g, '') !== d.cep.replace(/\D/g, '')) { frete = null; }
        envio = d;
        $('resumo1').textContent = d.nome + ' · ' + d.rua + ', ' + d.numero +
            (d.complemento ? ' (' + d.complemento + ')' : '') + ' · ' + d.cidade + '/' + d.uf + ' · CEP ' + d.cep;
        desenharResumo();
        irPara(2);
        if (!frete) { calcularFrete(); }
    });

    /* ============ ETAPA 2: FORMA DE ENVIO ============ */
    var lista = $('opcoesFrete');
    var continuar2 = $('continuar2');

    function calcularFrete() {
        lista.innerHTML = '';
        continuar2.disabled = true;
        aviso('msg2', 'Calculando PAC e SEDEX para o seu CEP…');
        fetch(dado('url-frete'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cep: envio.cep.replace(/\D/g, ''), quantidade: quantidade })
        })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
                if (!res.ok) {
                    aviso('msg2', res.d.erro || 'Não foi possível calcular o frete.', 'erro');
                    var tentar = document.createElement('button');
                    tentar.type = 'button'; tentar.className = 'btn-frete'; tentar.textContent = 'Tentar de novo';
                    tentar.addEventListener('click', calcularFrete);
                    lista.appendChild(tentar);
                    return;
                }
                aviso('msg2', 'Escolha como prefere receber:');
                mostrarOpcoes(res.d.opcoes);
            })
            .catch(function () { aviso('msg2', 'Sem conexão. Confira a internet e tente de novo.', 'erro'); });
    }

    function mostrarOpcoes(opcoes) {
        lista.innerHTML = '';
        opcoes.forEach(function (o, n) {
            var rotulo = document.createElement('label');
            rotulo.className = 'frete-opcao';
            rotulo.style.animationDelay = (n * 0.06) + 's';
            var radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'frete'; radio.value = o.id;
            var nome = document.createElement('span');
            nome.className = 'frete-nome';
            nome.textContent = o.nome;                     // "PAC" ou "SEDEX"
            if (o.prazo) {
                var prazo = document.createElement('small');
                prazo.textContent = (o.empresa ? o.empresa + ' · ' : '') + 'chega em até ' + o.prazo + (o.prazo === 1 ? ' dia útil' : ' dias úteis');
                nome.appendChild(prazo);
            }
            var valor = document.createElement('span');
            valor.className = 'frete-valor';
            valor.textContent = brl(o.preco);
            radio.addEventListener('change', function () {
                frete = { id: o.id, preco: o.preco, nome: o.nome, prazo: o.prazo };
                continuar2.disabled = false;
                desenharResumo();
            });
            rotulo.appendChild(radio); rotulo.appendChild(nome); rotulo.appendChild(valor);
            lista.appendChild(rotulo);
            if (frete && frete.id === o.id) { radio.checked = true; continuar2.disabled = false; }
        });
    }

    continuar2.addEventListener('click', function () {
        if (!frete) { return; }
        $('resumo2').textContent = frete.nome + ' · ' + brl(frete.preco) +
            (frete.prazo ? ' · até ' + frete.prazo + ' dias úteis' : '');
        irPara(3);
    });

    /* ============ ETAPA 3: PAGAMENTO ============ */
    var finalizar = $('finalizar');
    if (dado('falhou') === 'sim') {
        aviso('msg3', 'O pagamento com cartão não foi concluído. Confira os dados e tente de novo.', 'erro');
    }
    if (dado('online') !== 'sim') {
        finalizar.disabled = true;
        aviso('msg3', 'O pagamento online ainda não está disponível.', 'erro');
    }

    finalizar.addEventListener('click', function () {
        if (!envio || !frete) { irPara(!envio ? 1 : 2); return; }
        var forma = document.querySelector('input[name="forma"]:checked').value;
        var pacote = {};
        CAMPOS.forEach(function (n) { pacote[n] = envio[n]; });
        pacote.quantidade = quantidade;
        pacote.frete_id = frete.id;
        pacote.forma = forma;

        var textoBotao = finalizar.innerHTML;
        finalizar.disabled = true;
        finalizar.textContent = forma === 'pix' ? 'Gerando o Pix…' : 'Abrindo o pagamento…';
        aviso('msg3', '');
        fetch(dado('url-pedido'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pacote)
        })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
                if (!res.ok) {
                    aviso('msg3', res.d.erro || 'Não foi possível registrar o pedido.', 'erro');
                    finalizar.disabled = false; finalizar.innerHTML = textoBotao;
                    return;
                }
                if (res.d.forma === 'cartao' && res.d.link) { window.location.href = res.d.link; return; }
                if (res.d.forma === 'pix') { mostrarPix(res.d); return; }
                aviso('msg3', 'Resposta inesperada. Tente novamente.', 'erro');
                finalizar.disabled = false; finalizar.innerHTML = textoBotao;
            })
            .catch(function () {
                aviso('msg3', 'Sem conexão. Tente novamente.', 'erro');
                finalizar.disabled = false; finalizar.innerHTML = textoBotao;
            });
    });

    /* ---------- tela do Pix ---------- */
    var relogio = null, consulta = null;

    function mostrarPix(d) {
        pix = d;
        travado = true;                                   // pedido feito: não dá mais para editar 1 e 2
        Array.prototype.forEach.call(document.querySelectorAll('.ck-editar'), function (b) { b.hidden = true; });
        $('ckFormas').hidden = true;
        finalizar.hidden = true;
        $('ckPix').hidden = false;
        $('pixValor').textContent = brl(d.total);
        $('pixCodigo').value = d.copia_e_cola;
        if (d.qr_imagem) { $('pixQr').src = 'data:image/png;base64,' + d.qr_imagem; } else { $('pixQr').hidden = true; }

        // contagem regressiva (mm:ss)
        var fim = Date.now() + (d.minutos || 30) * 60 * 1000;
        function tic() {
            var falta = Math.max(0, Math.round((fim - Date.now()) / 1000));
            $('pixTempo').textContent = Math.floor(falta / 60) + ':' + ('0' + (falta % 60)).slice(-2);
            if (!falta) { pixExpirou(); }
        }
        tic();
        relogio = window.setInterval(tic, 1000);
        consulta = window.setInterval(conferirPix, 5000);   // "já pagou?" a cada 5 segundos
        $('ckPix').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function pararPix() { window.clearInterval(relogio); window.clearInterval(consulta); }

    function conferirPix() {
        if (document.hidden) { return; }                  // aba escondida: espera voltar
        fetch(dado('url-pix') + '?id=' + encodeURIComponent(pix.pagamento_id) + '&pedido=' + encodeURIComponent(pix.pedido))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.situacao === 'approved') { pixAprovado(); }
                else if (d.situacao === 'cancelled' || d.situacao === 'rejected' || d.situacao === 'expired') { pixExpirou(); }
            })
            .catch(function () { /* sem internet agora: tenta de novo na próxima volta */ });
    }
    // voltou para a aba (ex.: depois de pagar no app do banco)? confere na hora
    document.addEventListener('visibilitychange', function () { if (!document.hidden && pix && consulta) { conferirPix(); } });

    function pixAprovado() {
        pararPix();
        window.Sacola.limpar();                          // compra concluída: esvazia a sacola
        try { sessionStorage.removeItem('ckEnvio'); } catch (e) { /* ok */ }
        $('ckPix').hidden = true;
        $('sucessoPedido').textContent = pix.pedido;
        $('ckSucesso').hidden = false;
        $('ckSucesso').focus();
        Array.prototype.forEach.call($('ckPassos').children, function (li) { li.className = 'feito'; });
    }

    function pixExpirou() {
        pararPix();
        $('pixEspera').innerHTML = '';
        $('pixEspera').className = 'cupom-msg erro';
        $('pixEspera').textContent = 'Este Pix expirou ou foi cancelado. Recarregue a página para gerar um novo.';
        $('pixQr').classList.add('expirado');
    }

    /* botão "Copiar" do copia e cola */
    $('pixCopiar').addEventListener('click', function () {
        var botao = this;
        var codigo = $('pixCodigo');
        function feito() { botao.textContent = 'Copiado!'; window.setTimeout(function () { botao.textContent = 'Copiar'; }, 2500); }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(codigo.value).then(feito, function () { codigo.select(); });
        } else {
            codigo.select();                              // navegador antigo: seleciona e copia
            try { document.execCommand('copy'); feito(); } catch (e) { /* a pessoa copia à mão */ }
        }
    });

    desenharResumo();
})();
