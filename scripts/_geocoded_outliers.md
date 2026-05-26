# Reporte de geocoding - propiedades fuera del bounding box

Generado: 2026-05-26T19:16:06.854Z
Bbox valido: lat [-40.5, -37], lng [-63.5, -60]
(cubre Bahia Blanca, Monte Hermoso, Punta Alta, Pehuen Co, Sierras, Villarino)

- Geocodificadas OK dentro de region: **188**
- Outliers (fuera de region): **12**
- Fallaron sin resultado: **10**

---

## Outliers - props con coords sospechosas

| prop_id | direccion | zona declarada | coords erroneas | Nominatim devolvio |
|---|---|---|---|---|
| 15793 | Brigadier Lopez 3900 | Bahía Blanca | -32.6696, -61.0857 | Brigadier Estanislao López, Salto Grande, Municipio de Salto Grande, Departament... |
| 15876 | Presidente Peron 854 | Monte Hermoso | -31.7458, -60.5266 | 854, Presidente Perón, Barrio Saenz Peña, Paraná, Municipio de Paraná, Distrito ... |
| 20066 | Leuman 156 | Bahía Blanca | -34.7607, -58.6663 | Ruta 21 y Leuman, Otero, Lasalle, González Catán, Partido de La Matanza, Buenos ... |
| 20701 | Avenida Malvinas 33 | Monte Hermoso | -28.4379, -65.7880 | 33, Avenida Combatientes de Malvinas, Norte, San Fernando del Valle de Catamarca... |
| 22319 | Las Lavandas | Sierra de la Ventana | -34.6206, -68.3942 | Las Lavandas, Distrito Las Paredes, Departamento San Rafael, Mendoza, Argentina... |
| 23224 | C. Aladino esquina Rodirguez Peña | Monte Hermoso | -38.8226, -68.1559 | Aladino Fuentes, Eluney, Centenario, Municipio de Centenario, Departamento Confl... |
| 23503 | Siete Colores esquina Curumalat | Bahía Blanca | -32.8694, -68.8831 | Siete Colores, Dalvian (Barrio Privado), Ciudad de Mendoza, Sección 10ª Residenc... |
| 23558 | Ohiggins 29 | Bahía Blanca | -33.4589, -61.4781 | 29, OHiggins, Firmat, Municipio de Firmat, Departamento General López, Santa Fe,... |
| 24938 | Costanera 68 | Bahía Blanca | -36.5942, -56.6873 | 68, Costanera, Mar del Tuyú, Partido de La Costa, Buenos Aires, 7108, Argentina... |
| 25259 | Calle 43 al 888 | Bahía Blanca | -34.8157, -58.2807 | Intendente Guillermo Davidson, La Esmeralda, San Juan Bautista, Partido de Flore... |
| 25674 | Los Delfines y Del Calamar | Bahía Blanca | -24.8276, -65.4078 | Los Delfines, B° Manatial Sur, Bº Complejo Arenales, Salta, Capital, Salta, A440... |
| 25711 | Irigoyen 300 | Bahía Blanca | -31.1868, -60.7444 | 300, Irigoyen, Llambí Campbell, Municipio de Llambi Campbell, Departamento La Ca... |

**Acciones sugeridas para outliers:**
1. Verificar si la direccion esta bien cargada en el Sheet.
2. Si la direccion es real pero ambigua (ej. solo nombre de calle sin numero), agregar referencia: "Av. Argentina 1500, Monte Hermoso, Argentina".
3. Si la prop no existe o es un test, marcar como inactiva.

---

## Failed - sin resultado de Nominatim

| prop_id | direccion intentada |
|---|---|
| 6946 | Ruta 3 Sur KM 695 |
| 7130 | 17 de Mayo entre Estomba y Vicente Lopez |
| 8876 | O'Higinns 530 |
| 9071 | Charcas entre Saliquello y Los adobes |
| 17442 | Calle El Boyero 1300 |
| 19058 | Calle Hueglen entre Espora y San Martín |
| 19173 | Ing. J. Aguilar |
| 20221 | Laguna Blanca entre Luis Agote y Pilmaiquén |
| 23529 | Calle Lestonac y Cañada |
| 24962 | Calle Pigue al 1200 |