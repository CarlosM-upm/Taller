-- El DNI pasa del albarán al cliente.
--
-- Antes se tecleaba en cada albarán y se guardaba solo allí. Ahora es un dato
-- del cliente: se escribe una vez en Ajustes y todos sus albaranes lo leen de
-- ahí, así que corregirlo lo corrige en todos (igual que el nombre).
--
-- Nullable a propósito: los clientes que ya existen no lo tienen. La
-- aplicación exige el DNI al crear o editar un cliente, y no deja ELEGIR un
-- cliente sin DNI en un pedido, trabajo o albarán hasta que se le ponga.
alter table clientes add column dni varchar(20);

-- Se guarda ya limpio (mayúsculas, sin espacios ni guiones), así que basta
-- un índice único normal para que dos clientes no compartan DNI.
create unique index clientes_dni_unico on clientes (dni);

-- El DNI tecleado en cada albarán deja de usarse. Los trabajos y albaranes
-- existentes se van a borrar a mano al desplegar esta versión (decidido con
-- el taller), así que no se intenta pasar esos DNI a los clientes.
alter table albaranes drop column dni_cliente;
