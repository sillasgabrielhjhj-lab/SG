/* ==========================================================================
   ACHADOS VIP — CONFIGURAÇÃO CENTRAL (edite só este arquivo para o dia a dia)
   Cores e fontes: css/style.css (bloco :root). Textos: index.html.
   ========================================================================== */
window.ACHADOS_CONFIG = {
  // Link de convite do grupo de WhatsApp. TODOS os botões do site usam este valor.
  whatsappUrl: "https://chat.whatsapp.com/JxuPsZc7jxmLCs93WTBNjQ?s=cl&p=i&mlu=4&ilr=4",

  // Rastreamento opcional. Deixe "" para NÃO carregar nada. O evento medido é o CLIQUE no
  // botão do WhatsApp (não a entrada confirmada no grupo).
  metaPixelId: "", //     só números, ex.: "123456789012345"
  tiktokPixelId: "", //   ex.: "C1ABCDEFGHIJKLMNOP"
  ga4Id: "", //           ex.: "G-ABCDE12345"

  // Ofertas reais para o celular de exemplo. Vazio = mostra o exemplo ILUSTRATIVO (sem preços).
  // Cada oferta: { name, oldPrice, price, coupon, store } — oldPrice/price em reais (número).
  // O percentual de desconto é calculado sozinho. Use só ofertas que estejam valendo.
  // Exemplo (não deixe aqui sem estar valendo):
  //   { name: "Nome do produto", oldPrice: 199.9, price: 149.9, coupon: "CUPOM10", store: "Nome da loja" }
  offers: [],
};

// Marca que o JavaScript está ativo (as animações de entrada só rodam com ele).
document.documentElement.classList.add("js");
