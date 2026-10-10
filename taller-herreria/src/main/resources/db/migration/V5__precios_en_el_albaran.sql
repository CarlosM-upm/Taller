-- Precios en el albarán: el jefe pone un precio a cada material y un precio a
-- la hora, y el coste sale solo.
--
-- La columna materiales.precio ya existe desde la V3. Aquí entra lo que falta,
-- que vive en el albarán porque es de todo el documento y no de una línea.
--
-- El coste NO se guarda: se calcula al vuelo a partir de las líneas, las horas
-- y el importe extra. Guardarlo obligaría a recalcularlo y reescribirlo cada
-- vez que se toca un precio, y bastaría un fallo para que el documento dijera
-- un total que no cuadra con sus propias líneas.

ALTER TABLE albaranes ADD COLUMN precio_hora    numeric(10, 2);

-- Cantidad suelta en euros que el jefe suma al final (desplazamientos, un
-- extra pactado...). Admite negativo para aplicar un descuento.
ALTER TABLE albaranes ADD COLUMN importe_extra  numeric(10, 2);

-- Si el total aparece o no en el PDF que se entrega al cliente. Por defecto
-- NO: es preferible que el jefe lo marque a propósito a que se imprima un
-- precio sin querer en un documento que se entrega en mano.
ALTER TABLE albaranes ADD COLUMN incluir_total  boolean NOT NULL DEFAULT false;
