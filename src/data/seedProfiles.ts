export const seedProfiles = {
  bebidas: {
    name: 'Distribuidora de Bebidas',
    categories: ['Cervezas', 'Gaseosas', 'Vinos', 'Espirituosas'],
    products: [
      { name: 'Cerveza Stella Artois 1L', brand: 'Stella Artois', category: 'Cervezas', cost: 1800 },
      { name: 'Coca Cola 2.25L', brand: 'Coca Cola', category: 'Gaseosas', cost: 1200 },
      { name: 'Fernet Branca 750ml', brand: 'Branca', category: 'Espirituosas', cost: 6500 },
      { name: 'Vino Rutini Malbec', brand: 'Rutini', category: 'Vinos', cost: 8500 }
    ]
  },
  almacen: {
    name: 'Distribuidora de Almacén',
    categories: ['Fideos', 'Aceites', 'Harinas', 'Lácteos'],
    products: [
      { name: 'Aceite Natura 1.5L', brand: 'Natura', category: 'Aceites', cost: 2100 },
      { name: 'Harina Blancaflor 1kg', brand: 'Blancaflor', category: 'Harinas', cost: 850 },
      { name: 'Fideos Lucchetti Tallarín', brand: 'Lucchetti', category: 'Fideos', cost: 600 },
      { name: 'Leche La Serenísima 1L', brand: 'La Serenísima', category: 'Lácteos', cost: 1100 }
    ]
  },
  kiosko: {
    name: 'Distribuidora de Golosinas',
    categories: ['Alfajores', 'Chocolates', 'Caramelos', 'Cigarrillos'],
    products: [
      { name: 'Alfajor Jorgito Chocolate', brand: 'Jorgito', category: 'Alfajores', cost: 450 },
      { name: 'Chocolate Milka Oreo', brand: 'Milka', category: 'Chocolates', cost: 1200 },
      { name: 'Cigarrillos Marlboro Box', brand: 'Marlboro', category: 'Cigarrillos', cost: 2800 },
      { name: 'Caramelos Sugus 100u', brand: 'Sugus', category: 'Caramelos', cost: 1500 }
    ]
  },
  libreria: {
    name: 'Distribuidora de Librería',
    categories: ['Escolar', 'Escritura', 'Papelería', 'Arte'],
    products: [
      { name: 'Cuaderno Rivadavia 100h', brand: 'Rivadavia', category: 'Escolar', cost: 3200 },
      { name: 'Lapicera Bic Azul x12', brand: 'Bic', category: 'Escritura', cost: 1800 },
      { name: 'Hojas A4 Autor 500u', brand: 'Autor', category: 'Papelería', cost: 6500 },
      { name: 'Témperas Alba x10u', brand: 'Alba', category: 'Arte', cost: 2400 }
    ]
  },
  heladeria: {
    name: 'Distribuidora de Insumos para Heladería',
    categories: ['Baldes 10L', 'Salsas', 'Cucuruchos', 'Descartables'],
    products: [
      { name: 'Crema Americana 10L', brand: 'ArgenFrío', category: 'Baldes 10L', cost: 15400 },
      { name: 'Dulce de Leche Repostero 10kg', brand: 'Vacalin', category: 'Salsas', cost: 12500 },
      { name: 'Cucuruchos Artesanales x100', brand: 'Pasta-Wafer', category: 'Cucuruchos', cost: 4800 },
      { name: 'Salsa de Chocolate 1.2kg', brand: 'Águila', category: 'Salsas', cost: 3200 }
    ]
  },
  cotillon: {
    name: 'Distribuidora de Cotillón y Eventos',
    categories: ['Globos', 'Descartables', 'Decoración', 'Disfraces'],
    products: [
      { name: 'Globos Perlados R12 x50', brand: 'GloboFun', category: 'Globos', cost: 2100 },
      { name: 'Vela de Cumpleaños Gibre x12', brand: 'Candle-Party', category: 'Decoración', cost: 1200 },
      { name: 'Platos Plásticos Colores x20', brand: 'Party-Ware', category: 'Descartables', cost: 1800 },
      { name: 'Nieve Loca Rey Momo 500ml', brand: 'Rey Momo', category: 'Eventos', cost: 2500 }
    ]
  }
};
