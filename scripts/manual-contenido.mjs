/**
 * Contenido del manual de uso. Separado del armador para poder corregir textos sin
 * tocar el HTML. Cada capítulo es una persona: así se usa el manual en el local.
 */
export const CAPITULOS = [
  {
    id: 'cliente',
    persona: 'El cliente',
    entra: 'Desde el link o el QR de la mesa · no necesita cuenta',
    resumen:
      'Es la única parte que ve la gente de la calle. Todo lo demás del sistema existe para atender lo que entra por aquí.',
    pantallas: [
      {
        img: 'cliente-1-bienvenida.jpg',
        titulo: 'La bienvenida',
        alto: true,
        para: 'Es lo primero que abre. Su trabajo es dar hambre y llevarlo al menú.',
        puntos: [
          'La foto grande y las frases las cambias tú desde el panel.',
          '“Ver el menú” lleva a pedir. “Consultar mi pedido” es para quien ya pidió y quiere saber cómo va.',
          'Las promociones activas salen aquí solas.',
        ],
      },
      {
        img: 'cliente-2-menu.jpg',
        titulo: 'El menú',
        alto: true,
        para: 'Aquí arma el pedido. Las familias de platos se cambian con los botones de arriba.',
        puntos: [
          'Solo aparecen los platos activos. Los que marcas agotados salen en gris.',
          'Cada plato puede llevar una nota para la cocina (“sin cebolla”).',
          'Los combos se agregan completos, a su precio especial.',
        ],
      },
    ],
    escenarios: [
      {
        titulo: 'Pide a domicilio y paga en efectivo',
        pasos: [
          'Arma el pedido y toca <b>Continuar</b>.',
          'Escribe nombre, teléfono, dirección y barrio. Escoge <b>Efectivo</b>.',
          'Al confirmar, se le abre WhatsApp con el pedido ya escrito para que te lo mande.',
          'El pedido llega a <b>Caja</b> como “Contraentrega”. Hasta que caja no confirme, <u>no entra a cocina</u>.',
        ],
      },
      {
        titulo: 'Pide y paga por transferencia',
        pasos: [
          'Igual que arriba, pero escoge <b>Transferencia</b>.',
          'Pasa a una pantalla con el <b>valor exacto</b>, tu llave y tu cuenta, todo copiable.',
          'Desde ahí manda un solo mensaje de WhatsApp con el pedido, avisando que envía el comprobante.',
          'Cuando caja verifica la plata en el banco, el pedido entra a cocina.',
        ],
      },
      {
        titulo: 'Se arrepiente y quiere cambiar algo',
        nota: true,
        pasos: [
          'Mientras diga <b>“Falta tu pago”</b>, puede tocar <b>Modificar mi pedido</b>.',
          'Vuelve al menú con sus platos en el carrito, cambia lo que quiera y guarda.',
          'Sigue siendo <b>el mismo número de pedido</b>. Mientras edita, en tu caja aparece como “Modificando” y no lo puedes aprobar: aprobarlo a medias cobraría un valor que va a cambiar.',
          'Apenas caja aprueba, ya no puede modificarlo más.',
        ],
      },
      {
        titulo: 'Pide sentado en una mesa',
        pasos: [
          'Escanea el QR de su mesa y arma el pedido.',
          'No pide datos ni pago: el pedido queda esperando que el <b>mesero</b> lo confirme.',
        ],
      },
    ],
  },
  {
    id: 'cajero',
    persona: 'La cajera',
    entra: 'cajero@… · abre en Caja',
    resumen:
      'Es el filtro del negocio: nada entra a cocina sin que caja lo apruebe, y toda la plata del día pasa por aquí.',
    pantallas: [
      {
        img: 'cajero-1-caja.jpg',
        titulo: 'La caja',
        para: 'Arriba, cuánto entró por cada medio. Abajo, lo que está esperando algo de ti.',
        puntos: [
          'Las cuatro tarjetas muestran el dinero del turno y qué porcentaje representa cada medio.',
          'El borde de color de cada fila dice qué falta: ámbar espera decisión, verde está listo para cobrar.',
          'Arriba a la derecha salta un aviso cuando entra una transferencia nueva.',
        ],
      },
    ],
    escenarios: [
      {
        titulo: 'Llega una transferencia',
        pasos: [
          'Aparece la fila <b>Por verificar</b> con el valor exacto que debió llegar.',
          'Búscalo en tu banco. Si llegó, toca <b>Verifiqué</b>: el pedido entra a cocina y la plata queda registrada en el turno.',
          'Si no llegó, toca <b>No llegó</b>: el pedido se anula.',
          'Necesitas el turno abierto para verificar. Sin turno no hay dónde registrar esa plata.',
        ],
      },
      {
        titulo: 'Llega un domicilio contra entrega',
        pasos: [
          'Aparece como <b>Contraentrega</b>.',
          'Toca <b>Confirmar</b> para mandarlo a cocina, o <b>Anular</b> si el cliente ya no lo quiere.',
          'Esa plata entra a la caja cuando el domiciliario vuelve y le <b>legalizas</b> el efectivo.',
        ],
      },
      {
        titulo: 'Un cliente viene a pagar',
        pasos: [
          'Su pedido está en <b>Por cobrar</b> (verde).',
          'Toca <b>Cobrar</b>, escoge el medio real (efectivo, transferencia o datáfono) y confirma.',
          'Queda registrado en <b>Cobrados hoy</b>, con su factura lista para imprimir.',
        ],
      },
      {
        titulo: 'El cliente pide la cuenta o la factura',
        nota: true,
        pasos: [
          'Antes de pagar, el botón <b>Cuenta</b> imprime la <b>cuenta de cobro</b> — dice “no es su factura de venta” y para qué sirve.',
          'Después de cobrar, el botón <b>Factura</b> imprime la factura con el sello <b>Pagado</b>.',
          'Sale en 80 mm: entra en impresora de tirilla y también en hoja normal.',
          'Los precios son los que se cobraron ese día, aunque el plato haya subido de precio después.',
        ],
      },
      {
        titulo: 'Cerrar el turno',
        pasos: [
          'Toca <b>Cerrar turno</b> y escribe el efectivo que contaste.',
          'El sistema te dice si cuadra o cuánto sobra o falta.',
          'No te va a dejar cerrar si quedan pedidos en cocina o efectivo de domiciliarios sin recibir: te avisa cuántos.',
        ],
      },
    ],
  },
  {
    id: 'cocina',
    persona: 'La cocina',
    entra: 'cocina@… · una sola cuenta para las tres cocinas',
    resumen:
      'Una pantalla por cocina, y una sola cuenta que las ve todas. No ve precios ni datos del cliente: solo qué preparar.',
    pantallas: [
      {
        img: 'cocina-1-selector.jpg',
        titulo: 'Escoger la cocina',
        para: 'Al entrar, elige qué cocina va a ver esa tablet. Recuerda la última: al recargar no vuelve a preguntar.',
        puntos: ['Puede cambiar de cocina cuando quiera, sin cerrar sesión.'],
      },
      {
        img: 'cocina-2-tablero.jpg',
        titulo: 'El tablero de comandas',
        para: 'Cada ticket es un pedido. El color del borde dice cómo va el tiempo.',
        puntos: [
          '<b>Verde</b> va en tiempo, <b>ámbar</b> se acerca al objetivo, <b>rojo</b> ya se pasó.',
          '“Empezar a preparar” y luego “Marcar listo”. Al marcar listo, el ticket desaparece.',
          'Si algo se acabó, el botón <b>Agotar</b> lo saca de la carta al instante.',
          'Botón de sol/luna para cambiar a fondo oscuro si hay mucho reflejo.',
        ],
      },
    ],
    escenarios: [
      {
        titulo: 'Por qué los platos no llegan todos juntos',
        nota: true,
        pasos: [
          'El sistema calcula para atrás desde la hora de salida: lo que demora más entra primero.',
          'Si la hamburguesa toma 12 minutos y la gaseosa 1, bebidas recibe su comanda 11 minutos después.',
          'Así todo sale a la misma hora y nada se enfría esperando.',
        ],
      },
    ],
  },
  {
    id: 'pase',
    persona: 'El pase',
    entra: 'pase@… · abre en Pase',
    resumen:
      'El puesto que arma el pedido completo antes de que salga. Ve las tres cocinas de un vistazo.',
    pantallas: [
      {
        img: 'pase-1.jpg',
        titulo: 'Pase y despacho',
        para: 'Cada fila es un pedido, con un chip por cada cocina.',
        puntos: [
          'Chip <b>con color y check</b>: esa cocina ya terminó. Chip <b>gris con reloj</b>: todavía va.',
          'Chip con raya: ese pedido no lleva nada de esa cocina.',
          'Cuando las tres están listas, el botón <b>Liberar</b> se activa.',
        ],
      },
    ],
    escenarios: [
      {
        titulo: 'Despachar un domicilio',
        pasos: [
          'Cuando el pedido está completo, toca <b>Liberar</b>.',
          'Pasa a la pestaña <b>Por despachar</b>.',
          'Escoge el domiciliario en la lista y toca <b>Asignar domi</b>.',
          'Le aparece de una vez en el celular del domiciliario.',
        ],
      },
    ],
  },
  {
    id: 'mesero',
    persona: 'El mesero',
    entra: 'mesero@… · abre en Pedidos de mesa',
    resumen: 'Solo se ocupa de lo que piden desde el QR de las mesas.',
    pantallas: [
      {
        img: 'mesero-1.jpg',
        titulo: 'Pedidos de mesa',
        movil: true,
        para: 'Aquí caen los pedidos que los clientes hacen escaneando el QR.',
        puntos: [
          'Revisa que esté bien con el cliente y toca confirmar: ahí entra a cocina.',
          'Si la mesa no ha pedido nada todavía, la pantalla está vacía. Es normal.',
        ],
      },
    ],
    escenarios: [],
  },
  {
    id: 'domiciliario',
    persona: 'El domiciliario',
    entra: 'domi@… · abre en Mis entregas',
    resumen:
      'Pantalla de calle: letra grande, botones grandes, y solo sus entregas — nunca las de otro.',
    pantallas: [
      {
        img: 'domi-1.jpg',
        titulo: 'Mis entregas',
        movil: true,
        para: 'Una tarjeta por entrega, con la dirección en grande.',
        puntos: [
          'Recuadro <b>ámbar</b>: hay que cobrar ese valor en efectivo. Recuadro <b>verde</b>: ya está pago, no cobrar.',
          'Botones para llamar o escribir al cliente por WhatsApp.',
          '“Recogí, voy en camino” → “Entregué”. Si no pudo entregar, deja el motivo.',
        ],
      },
    ],
    escenarios: [
      {
        titulo: 'Al volver al local',
        pasos: [
          'Entrega a caja el efectivo que recogió.',
          'La cajera lo <b>legaliza</b> y ahí entra al turno.',
          'La caja no cierra mientras quede efectivo sin legalizar.',
        ],
      },
    ],
  },
  {
    id: 'dueno',
    persona: 'El dueño',
    entra: 'admin@… · abre en el Tablero',
    resumen:
      'Ve y controla todo: las ventas, la carta, el equipo, las promociones y — solo tú — la rentabilidad.',
    pantallas: [
      {
        img: 'dueno-1-tablero.jpg',
        titulo: 'Tablero',
        para: 'El resumen del día: ventas, pedidos, ticket promedio y cuántos hay en cocina.',
        puntos: ['Abajo, cuánto vendió cada cocina y las alertas que necesitan tu atención.'],
      },
      {
        img: 'dueno-2-pedidos-vivo.jpg',
        titulo: 'Pedidos en vivo',
        para: 'Todo lo que está pasando ahora mismo, del más nuevo al más viejo.',
        puntos: [
          'Filtra por canal: mesa, domicilio o mostrador.',
          'Cada pedido muestra qué lleva, quién lo pidió, su teléfono (tocable, abre WhatsApp) y a dónde va.',
          'En los que están en cocina, las barritas de color dicen qué cocina ya terminó.',
        ],
      },
      {
        img: 'dueno-3-carta.jpg',
        titulo: 'Carta',
        para: 'Aquí vive tu menú: agregar platos, cambiar precios, subir fotos.',
        puntos: [
          '<b>POPULAR</b> marca el plato para que salga en “Nuestros especiales” de la página de inicio.',
          '<b>Agotado</b> lo saca de la carta al instante, sin borrarlo.',
          '<b>Editar</b> cambia nombre, precio, minutos de preparación, familia y en qué cocina se prepara.',
          '“Retirar de la carta” no borra el plato: los pedidos y reportes viejos siguen cuadrando.',
        ],
      },
      {
        img: 'dueno-4-cocinas.jpg',
        titulo: 'Cocinas',
        para: 'Las cocinas que preparan los platos, cada una con su pantalla y su color.',
        puntos: [
          'Puedes crear, renombrar, cambiar el color y apagar cocinas.',
          'Una cocina con platos activos no se deja apagar: quedarían sin quién los prepare.',
        ],
      },
      {
        img: 'dueno-5-pagina-inicio.jpg',
        titulo: 'Página de inicio',
        para: 'Todo lo que ve el cliente al abrir el link: fotos, frases y datos de contacto.',
        puntos: [
          'Logo, foto del plato de portada, foto del local y video opcional.',
          'Todas las frases de bienvenida y de “Sobre nosotros”.',
          'Dirección, horario, WhatsApp, y la llave y cuenta para transferencias.',
        ],
      },
      {
        img: 'dueno-6-promociones.jpg',
        titulo: 'Promociones',
        para: 'Tres tipos, y cada uno hace algo distinto de verdad.',
        puntos: [
          '<b>Domicilio gratis</b>: pones el monto mínimo y el envío se cobra en $0 solo.',
          '<b>Combo</b>: escoges los platos y su precio especial. El sistema cobra ese precio, no la suma.',
          '<b>Aviso</b>: solo texto, no cambia el cobro.',
          'La vista previa te muestra cómo se verá antes de guardar.',
        ],
      },
      {
        img: 'dueno-7-equipo.jpg',
        titulo: 'Equipo',
        para: 'Las cuentas de tu gente.',
        puntos: [
          'Crear una cuenta: nombre, correo, contraseña y su puesto.',
          '<b>Activo/Inactivo</b> le quita el acceso sin borrar su historial.',
          'Solo tú puedes nombrar a otro dueño.',
        ],
      },
      {
        img: 'dueno-8-reportes.jpg',
        titulo: 'Reportes',
        para: 'Cómo va el negocio, mes a mes.',
        puntos: [
          'Ventas, pedidos y ticket promedio, comparados con el mes anterior.',
          'Ventas por día, por cocina y los platos más vendidos.',
          'Abajo, <b>Rentabilidad</b>: cargas el costo de cada plato y ves tu utilidad real. Solo tú la ves.',
        ],
      },
      {
        img: 'dueno-9-monitoreo.jpg',
        titulo: 'Monitoreo en vivo',
        para: 'Ver las pantallas de cocina, el pase y los domicilios sin moverte del puesto.',
        puntos: [
          'Es <b>solo lectura</b>: miras dónde va lento, pero no marcas ni liberas nada desde aquí.',
          'Es a propósito: operar a distancia desordena a quien está en el puesto.',
        ],
      },
    ],
    escenarios: [],
  },
]

export const RECORRIDO = [
  ['1', 'El cliente pide', 'Desde el link o el QR', 'Menú del cliente'],
  ['2', 'Caja aprueba', 'Verifica la transferencia o confirma la contraentrega', 'Caja'],
  ['3', 'Cocina prepara', 'Cada cocina recibe lo suyo, escalonado para que salga junto', 'Cocina'],
  ['4', 'El pase arma', 'Espera a que las tres cocinas terminen y libera', 'Pase'],
  ['5', 'Sale', 'El domiciliario lo lleva, o el cliente lo recoge', 'Domicilios'],
  ['6', 'Se cobra', 'Entra al turno y queda su factura', 'Caja'],
]

export const PROBLEMAS = [
  [
    'No me aparece “Nuestros especiales” en la página del cliente',
    'No hay platos marcados. Ve a <b>Carta</b> y enciende <b>POPULAR</b> en dos o tres platos.',
  ],
  [
    'No puedo cerrar el turno',
    'Quedan pedidos en cocina o efectivo de domiciliarios sin recibir. El mensaje te dice cuántos.',
  ],
  [
    'No puedo verificar una transferencia',
    'O la caja está cerrada (abre el turno primero), o el cliente está modificando ese pedido en este momento.',
  ],
  [
    'Un cliente dice que pagó y su pedido no avanza',
    'Búscalo en <b>Por verificar</b>. Mientras caja no confirme que la plata llegó, el pedido no entra a cocina.',
  ],
  [
    'Subí una foto y no aparece',
    'Revisa que pese menos de 5 MB. El video, menos de 10 MB.',
  ],
]
