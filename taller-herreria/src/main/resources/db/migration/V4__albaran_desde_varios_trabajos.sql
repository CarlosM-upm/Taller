-- Un albarán puede nacer de VARIOS trabajos del mismo cliente, no solo de uno.
--
-- El caso real: a un cliente se le hacen tres visitas en el mes y se le entrega
-- un único albarán al cobrar, no tres. Hasta ahora la relación era uno a uno
-- (albaranes.trabajo_id con restricción única), así que había que emitir un
-- albarán por trabajo.
--
-- Lo que NO cambia: un trabajo sigue pudiendo estar en un solo albarán. Eso es
-- lo que impide facturar dos veces lo mismo, y ahora lo garantiza la
-- restricción única sobre trabajo_id de la tabla de relación.

CREATE TABLE albaran_trabajos (
    albaran_id bigint NOT NULL,
    trabajo_id bigint NOT NULL,
    PRIMARY KEY (albaran_id, trabajo_id),

    -- Un trabajo, como mucho, en un albarán. La comprobación también está en
    -- el servicio para poder dar un mensaje claro diciendo en cuál está, pero
    -- conviene que la base de datos no admita lo contrario ni por error.
    CONSTRAINT uq_albaran_trabajo_unico UNIQUE (trabajo_id),

    CONSTRAINT fk_albtrab_albaran FOREIGN KEY (albaran_id)
        REFERENCES albaranes (id) ON DELETE CASCADE,

    -- Sin cascada a propósito: borrar un trabajo que ya generó albarán tiene
    -- que fallar. El servicio lo corta antes con un 409 explicando cuál es.
    CONSTRAINT fk_albtrab_trabajo FOREIGN KEY (trabajo_id)
        REFERENCES trabajos (id)
);

INSERT INTO albaran_trabajos (albaran_id, trabajo_id)
SELECT id, trabajo_id FROM albaranes;

ALTER TABLE albaranes DROP CONSTRAINT uq_albaran_trabajo;
ALTER TABLE albaranes DROP COLUMN trabajo_id;
