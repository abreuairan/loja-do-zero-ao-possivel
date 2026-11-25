# Loja "Do Zero ao Possível"

Loja on-line para a venda do livro físico **"Do Zero ao Possível!"**, de Ivan de Souza Dutra. É um e-commerce completo de uma página: apresenta o livro e o autor, calcula o frete pelo CEP e recebe o pagamento por **Pix** ou **cartão**.

**Site no ar:** https://loja-do-zero-ao-possivel-sfp2.onrender.com

---

## Telas

| Início | Comprar |
|:---:|:---:|
| <img src="prints/1-inicio.jpg" width="260" alt="Tela inicial da loja"> | <img src="prints/2-comprar.jpg" width="260" alt="Seção de compra com carrossel de fotos do livro"> |

---

## Funcionalidades

- **Sacola de compras** em painel lateral: o livro entra na sacola sem sair da página, e os itens ficam guardados no navegador
- **Finalizar compra em 3 etapas**: dados de envio → forma de envio → pagamento
- **Endereço preenchido pelo CEP** (ViaCEP)
- **Cálculo de frete real** com PAC e SEDEX (API do Melhor Envio)
- **Pix com QR Code e "copia e cola" na própria loja**: a tela muda sozinha para "Pagamento aprovado!" quando o Pix cai
- **Cartão pelo Mercado Pago**: a loja nunca vê os dados do cartão
- **Pedidos registrados numa planilha Google** e e-mails automáticos
- **Carrossel de fotos** do livro (com toque e teclado), animações ao rolar e barra de compra fixa no celular
- **Ligação com o questionário do livro** ([ver projeto](../questionario-do-zero-ao-possivel))

## Segurança

- **Preços e frete calculados sempre no servidor**: mudar o valor pelo navegador não adianta
- **Tokens do Mercado Pago e do Melhor Envio só no servidor**, em variáveis de ambiente, nunca no navegador
- **Confirmação do pagamento direto com o Mercado Pago** antes de marcar o pedido como pago
- Limite de tamanho nas requisições e limite de quantidade por pedido

## Tecnologias

| Parte | O que usei |
|---|---|
| Front-end | HTML5, CSS3 (responsivo, *mobile first*), JavaScript puro |
| Back-end | Python 3, Flask, Jinja2 |
| Integrações | API do Mercado Pago (Pix e cartão), API do Melhor Envio, ViaCEP |
| Dados e e-mail | Google Apps Script + Google Planilhas |
| Hospedagem | Render (com Gunicorn) |
| Ferramentas | VS Code, Git e GitHub |

---

## O que tem neste repositório

Este é um **repositório-vitrine**: ele mostra a parte visual da loja (o que roda no navegador).

```
templates/   páginas HTML (Jinja2): loja, sacola, finalizar compra e menu
static/      CSS, JavaScript (sacola, checkout, frete, carrossel) e imagens
prints/      capturas de tela do site
```

O **back-end** (servidor em Flask, pagamentos, frete e pedidos) é **privado**, por segurança. Por isso o projeto não roda só com estes arquivos. Para ver funcionando, acesse o [site no ar](https://loja-do-zero-ao-possivel-sfp2.onrender.com).

## O que aprendi

- Integrar um site com APIs de pagamento e de frete de verdade
- Por que **nunca confiar no navegador** para preço e pagamento, e como validar tudo no servidor
- Montar um checkout em etapas que funciona bem no celular
- Acompanhar o pagamento do Pix em tempo real e atualizar a tela sozinha
- Guardar chaves de API com segurança em produção

---

Desenvolvido por **Airan Abreu Tavares** · [@abreuairan](https://github.com/abreuairan)

Projeto feito para um cliente e publicado aqui com autorização. © Todos os direitos reservados: o código pode ser visto para avaliação, mas não pode ser copiado ou reutilizado sem permissão.
