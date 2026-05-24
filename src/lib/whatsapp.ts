interface OrderItem {
  name: string;
  quantity: number;
  presentation: string;
  price: number;
}
import { useSettingsStore } from '../store/useSettingsStore';

interface OrderData {
  clientName: string;
  cuit: string;
  zone: string;
  items: OrderItem[];
  total: number;
  observations?: string;
}

export const generateWhatsAppLink = (data: OrderData) => {
  const { clientName, cuit, zone, items, total, observations } = data;
  const settings = useSettingsStore.getState();
  const distributorName = settings.distributorName;
  
  // Resolve settings phone
  const rawPhone = settings.phone || '';
  let phone = rawPhone.replace(/\D/g, '');
  if (phone.length === 10) {
    phone = '549' + phone;
  }
  const finalPhone = phone || '5492920308605';

  let message = `Hola ${distributorName}, quiero realizar este pedido:\n\n`;
  message += `*Cliente:* ${clientName}\n`;
  message += `*CUIT:* ${cuit}\n`;
  message += `*Zona:* ${zone}\n\n`;
  message += `*Pedido:*\n`;

  items.forEach((item) => {
    message += `• ${item.quantity} un. x ${item.name} - Subtotal: $${item.price.toLocaleString('es-AR')}\n`;
  });

  message += `\n*Total estimado:* $${total.toLocaleString('es-AR')}\n`;
  
  if (observations) {
    message += `*Observaciones:* ${observations}`;
  }

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${finalPhone}?text=${encodedMessage}`;
};

export const openWhatsApp = (data: OrderData) => {
  const link = generateWhatsAppLink(data);
  window.open(link, '_blank');
};
