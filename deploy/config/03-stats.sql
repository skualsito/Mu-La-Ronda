-- Mu La Ronda - maximo de cada stat base: 32767.
--
-- OpenMU no trae tope para Fuerza/Agilidad/Vitalidad/Energia/Comando, y el
-- cliente de S6 los recibe en 16 bits: pasado el tope el numero "da la vuelta".
-- Con MaximumValue el servidor corta ahi (IncreaseStatsAction recorta lo
-- pedido y avisa "maximo alcanzado").
UPDATE config."AttributeDefinition"
   SET "MaximumValue" = 32767
 WHERE "Id" IN (
   '123282fe-fead-448e-ad2c-baece939b4b1',  -- Base Strength
   '1ae9c014-e3cd-4703-bd05-1b65f5f94ceb',  -- Base Agility
   '6ca5c3a6-b109-45a5-87a7-fdcb107b4982',  -- Base Vitality
   '01b0ef28-f7a0-46b5-97ba-2b624a54cd75',  -- Base Energy
   '6af2c9df-3ae4-4721-8462-9a8ec7f56fe4'); -- Base Leadership
