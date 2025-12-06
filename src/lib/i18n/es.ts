// Spanish translations for Project Aurora
// Note: Database values (status, type) remain in English

export const es = {
  common: {
    save: "Guardar",
    saving: "Guardando...",
    cancel: "Cancelar",
    edit: "Editar",
    actions: "Acciones",
    loading: "Cargando...",
    noData: "Sin datos",
    required: "obligatorio",
    unexpectedError: "Error inesperado",
  },

  // Status labels (DB values → Spanish labels)
  statusLabels: {
    available: "Disponible",
    occupied: "Ocupada",
    cleaning: "En limpieza",
    maintenance: "En mantenimiento",
  } as Record<string, string>,

  // Room type labels (DB values → Spanish labels)
  roomTypeLabels: {
    single: "Sencilla",
    double: "Doble",
    suite: "Suite",
    deluxe: "Deluxe",
  } as Record<string, string>,

  roomsPage: {
    title: "Habitaciones",
    addRoom: "Agregar habitación",
    editRoom: "Editar habitación",
    newRoom: "Nueva habitación",
    noRooms: "Aún no hay habitaciones.",
    addFirstRoom: "Agregar tu primera habitación",
    roomCreated: "Habitación creada exitosamente",
    roomUpdated: "Habitación actualizada exitosamente",
    columns: {
      number: "Número",
      type: "Tipo",
      basePrice: "Precio base",
      status: "Estado",
      notes: "Notas",
    },
    form: {
      numberLabel: "Número de habitación",
      numberPlaceholder: "ej., 101, A-201",
      typeLabel: "Tipo",
      typePlaceholder: "Seleccionar tipo",
      basePriceLabel: "Precio base",
      statusLabel: "Estado",
      statusPlaceholder: "Seleccionar estado",
      notesLabel: "Notas",
      notesPlaceholder: "Notas opcionales sobre esta habitación",
    },
    validation: {
      numberRequired: "El número de habitación es obligatorio",
      typeRequired: "El tipo de habitación es obligatorio",
      pricePositive: "El precio base debe ser 0 o mayor",
    },
  },

  guestsPage: {
    title: "Huéspedes",
    addGuest: "Agregar huésped",
    editGuest: "Editar huésped",
    newGuest: "Nuevo huésped",
    noGuests: "No hay huéspedes registrados todavía.",
    addFirstGuest: "Agregar tu primer huésped",
    guestCreated: "Huésped creado exitosamente",
    guestUpdated: "Huésped actualizado exitosamente",
    searchPlaceholder: "Buscar por nombre o documento",
    columns: {
      name: "Nombre",
      document: "Documento",
      phone: "Teléfono",
      email: "Correo",
    },
    form: {
      nameLabel: "Nombre",
      namePlaceholder: "Nombre completo del huésped",
      documentLabel: "Documento",
      documentPlaceholder: "Número de documento (opcional)",
      phoneLabel: "Teléfono",
      phonePlaceholder: "Número de teléfono (opcional)",
      emailLabel: "Correo electrónico",
      emailPlaceholder: "correo@ejemplo.com (opcional)",
    },
    validation: {
      nameRequired: "El nombre es obligatorio",
      emailInvalid: "El formato del correo electrónico no es válido",
    },
  },

  // Reservation status labels (DB values → Spanish labels)
  reservationStatusLabels: {
    booked: "Reservada",
    checked_in: "Check-in",
    checked_out: "Check-out",
    cancelled: "Cancelada",
    no_show: "No show",
  } as Record<string, string>,

  reservationsPage: {
    title: "Reservas",
    newReservation: "Nueva reserva",
    noReservations: "No hay reservas registradas todavía.",
    reservationCreated: "Reserva creada exitosamente",
    columns: {
      room: "Habitación",
      guest: "Huésped",
      checkIn: "Ingreso",
      checkOut: "Salida",
      status: "Estado",
      finalPrice: "Precio final",
    },
    form: {
      guestLabel: "Huésped",
      guestPlaceholder: "Seleccionar huésped",
      roomLabel: "Habitación",
      roomPlaceholder: "Seleccionar habitación",
      checkInLabel: "Fecha de ingreso",
      checkOutLabel: "Fecha de salida",
      basePriceLabel: "Precio base",
      finalPriceLabel: "Precio final",
    },
    validation: {
      guestRequired: "Debe seleccionar un huésped",
      roomRequired: "Debe seleccionar una habitación",
      checkInRequired: "La fecha de ingreso es obligatoria",
      checkOutRequired: "La fecha de salida es obligatoria",
      checkOutAfterCheckIn: "La fecha de salida debe ser posterior a la de ingreso",
    },
  },

  debugPage: {
    title: "Debug BD – Pruebas de Hotel",
    runAllTests: "Ejecutar todas las pruebas",
    running: "Ejecutando...",
    waitingToRun: "Esperando ejecución...",
    tests: {
      createRoom: "Prueba 1 – Crear habitación de prueba",
      createGuest: "Prueba 2 – Crear huésped de prueba",
      validReservation: "Prueba 3 – Crear reservación válida",
      invalidReservation: "Prueba 4 – Reservación inválida debe fallar",
    },
    statusLabels: {
      idle: "INACTIVO",
      running: "EJECUTANDO",
      success: "ÉXITO",
      error: "ERROR",
    } as Record<string, string>,
    messages: {
      roomCreated: (id: string) => `Habitación creada con ID: ${id}`,
      guestCreated: (id: string) => `Huésped creado con ID: ${id}`,
      reservationCreated: (id: string) => `Reservación creada con ID: ${id}`,
      missingDependencies: "Falta la habitación o el huésped de prueba. Ejecuta las pruebas 1 y 2 primero.",
      invalidDatesAllowed: "Se esperaba un error por fechas inválidas pero la inserción fue permitida. Verifica la restricción en la BD.",
      constraintWorking: (error: string) => `¡Restricción funcionando! Error: ${error}`,
    },
  },
} as const;
