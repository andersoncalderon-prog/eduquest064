const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:5173/');
    // Rellenar nombre
    await page.fill('input[placeholder="Tu nombre aquí..."]', 'AutoTester');
    await page.click('text=Siguiente');
    // Elegir primer avatar
    await page.click('div.grid button');
    // Empezar partida
    await page.click('text=Empezar Partida');

    // Esperar a que aparezca una pregunta
    await page.waitForSelector('div.text-2xl, div.text-5xl, div.text-3xl, .bg-white');
    // Intentar resolver preguntas aritméticas hasta 5 intentos
    for (let attempt = 0; attempt < 5; attempt++) {
      // Esperar opciones cargadas
      const optionButtons = await page.$$('button');
      // Obtener pregunta texto (buscar elemento que parezca contener la pregunta)
      const qEl = await page.$('div.text-2xl, div.text-3xl, div.text-5xl');
      const qText = qEl ? (await qEl.innerText()).trim() : '';
      console.log('Pregunta detectada:', qText);

      // Intentar parsear operaciones simples
      let expected = null;
      const plusMatch = qText.match(/(\d+)\s*[+\+]\s*(\d+)(?:\s*[+\+]\s*(\d+))?/);
      const timesMatch = qText.match(/(\d+)\s*[×x\*]\s*(\d+)/);
      const minusMatch = qText.match(/(\d+)\s*-\s*(\d+)/);
      const divMatch = qText.match(/(\d+)\s*[÷/]\s*(\d+)/);
      if (plusMatch) {
        expected = Number(plusMatch[1]) + Number(plusMatch[2]) + (plusMatch[3] ? Number(plusMatch[3]) : 0);
      } else if (timesMatch) {
        expected = Number(timesMatch[1]) * Number(timesMatch[2]);
      } else if (minusMatch) {
        expected = Number(minusMatch[1]) - Number(minusMatch[2]);
      } else if (divMatch) {
        expected = Math.floor(Number(divMatch[1]) / Number(divMatch[2]));
      }

      if (expected !== null) {
        const expectedStr = String(expected);
        console.log('Esperado:', expectedStr);
        // Buscar botón con ese texto
        const btn = await page.$(`button:has-text("${expectedStr}")`);
        if (btn) {
          await btn.click();
        } else {
          // Si no hay botón con el texto esperado, pulsa el primer botón
          await optionButtons[optionButtons.length-1].click();
        }
      } else {
        // No se pudo calcular: pulsa el primer botón
        if (optionButtons.length > 0) await optionButtons[optionButtons.length-1].click();
      }

      // Esperar feedback
      try {
        await page.waitForSelector('div.absolute.inset-0', { timeout: 3000 });
        const fb = await page.$('div.absolute.inset-0');
        const fbText = fb ? (await fb.innerText()) : '';
        console.log('Feedback:', fbText.trim());
      } catch (e) {
        console.log('No se mostró overlay de feedback.');
      }

      // Esperar un momento antes de siguiente pregunta
      await page.waitForTimeout(1200);
    }

    console.log('Prueba completada.');
  } catch (e) {
    console.error('Error en test:', e);
  } finally {
    await browser.close();
  }
})();
