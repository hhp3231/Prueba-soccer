# Polla Mundialista 2026 · Starter estático para GitHub Pages

Este paquete contiene un **frontend estático** (HTML/CSS/JS) más **datos JSON** para publicar una polla del Mundial 2026 en GitHub Pages, sin backend.

## Estructura
```
wc2026/
  index.html
  styles.css
  app.js
  data/
    matches.json         # Partidos (derivados del formulario)
    predictions.json     # Predicciones por participante (desde el Excel de Forms)
    results.json         # Resultados reales (20 primeros partidos, ficticios de ejemplo)
    bonus_picks.json     # Picks iniciales por participante (plantilla)
    bonus_actual.json    # Clasificados reales por fase (plantilla)
```

## Cómo usar
1. Habilita GitHub Pages apuntando a la rama donde subas esta carpeta.
2. Actualiza `data/results.json` a medida que se jueguen los partidos. Mantén el formato:
   ```json
   {"results": [ {"matchId": 1, "homeGoals": 2, "awayGoals": 1 }, ... ]}
   ```
3. (Opcional) Completa `data/bonus_picks.json` con los equipos que cada participante eligió **desde el inicio** por fase; y `data/bonus_actual.json` con los clasificados reales. Los puntajes de bonus se calculan así:
   - Dieciseisavos (32 equipos): **2 pts c/u**
   - Octavos (16): **5 pts c/u**
   - Cuartos (8): **10 pts c/u**
   - Semifinal (4): **15 pts c/u**
   - 3.º y 4.º (2): **17 pts c/u**
   - Final (2): **20 pts c/u**

## Reglas de puntuación (partido a partido)
- **5 pts** → Marcador exacto.
- **3 pts** → Ganador correcto **y** acierta los goles del ganador; **o** empate con marcador distinto al real.
- **2 pts** → Solo acierta el **resultado** (ganador o empate), con marcador diferente.
- **1 pt** → Acierta los goles de **uno** de los equipos (sin importar resultado).
- **0 pts** → No acierta.

> Nota: todos los cálculos se hacen en el navegador. No se requiere ningún servicio externo.

## Importar desde el Excel de Forms
- Este paquete fue generado a partir del archivo `Prueba mundial_20_ficticias.xlsx`.
- El script detecta que la **columna F y G** del Excel son el **primer partido** (equipo local y visitante), y así sucesivamente **por pares**.
- Puedes reemplazar `data/predictions.json` repitiendo el proceso de transformación o ajustando manualmente.

## Personalización
- Colores y estilos en `styles.css`.
- Lógica de puntos en `app.js` > `pointsPerMatch` y `BONUS_WEIGHTS`.

## Licencia
Uso libre para fines personales/organizacionales. Los nombres de equipos son marcas de sus respectivos titulares.
