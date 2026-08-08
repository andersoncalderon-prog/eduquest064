const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  page1.on('console', msg => console.log('P1 console:', msg.type(), msg.text()));
  page1.on('pageerror', err => console.log('P1 pageerror:', err.toString()));
  page2.on('console', msg => console.log('P2 console:', msg.type(), msg.text()));
  page2.on('pageerror', err => console.log('P2 pageerror:', err.toString()));

  try {
    await page1.goto('http://localhost:5173/?dev=1&dev_register=PlayerTwo');
    await page2.goto('http://localhost:5173/?dev=1&dev_register=PlayerOne');

    // Preparar ambos usuarios
    await page1.fill('input[placeholder="Tu nombre aquí..."]', 'PlayerOne');
    await page1.click('text=Siguiente');
    await page1.click('div.grid button');

    await page2.fill('input[placeholder="Tu nombre aquí..."]', 'PlayerTwo');
    await page2.click('text=Siguiente');
    await page2.click('div.grid button');

    // Esperar a dashboard en ambos
    await page1.waitForSelector('text=Jugadores en Línea', { timeout: 15000 });
    await page2.waitForSelector('text=Jugadores en Línea', { timeout: 15000 });

    // Inspeccionar contenido del lobby para entender por qué no aparece el oponente
    try {
      const lobbySection = page1.locator('text=Jugadores en Línea').first().locator('..');
      const lobbyText = await lobbySection.innerText();
      console.log('Lobby (page1) contenido inicial:\n', lobbyText.slice(0,500));
    } catch(e) { console.log('No se pudo leer el lobby inicialmente'); }

    // Esperar a que el otro usuario aparezca en la lista (hasta 30s)
    let opponentVisible = false;
    for (let t=0; t<30; t++) {
      try {
        const el = await page1.$(`text=PlayerTwo`);
        if (el) { opponentVisible = true; break; }
      } catch(e) {}
      await page1.waitForTimeout(1000);
    }
    if (!opponentVisible) throw new Error('Opponent did not appear in lobby');

    // Hacer clic en 'Enviar Reto' dentro del card del oponente usando XPath
    const sendBtn = await page1.$("xpath=//div[.//text()[contains(., 'PlayerTwo')]]//button[contains(., 'RETAR') or contains(., 'Enviar Reto')]");
    if (!sendBtn) throw new Error('No se encontró botón de reto para PlayerTwo');
    await sendBtn.click();

    // Confirmar reto en modal (page1)
    await page1.waitForSelector('text=Enviar Reto ⚔️');
    await page1.click('text=Enviar Reto ⚔️');
    await page1.waitForTimeout(500);
    const keys1 = await page1.evaluate(() => Object.keys(localStorage));
    console.log('localStorage keys (page1):', keys1.slice(0,20));
    const devKeys1 = keys1.filter(k=>k.startsWith('dev_battle_'));
    if (devKeys1.length>0) {
      const raw = await page1.evaluate((k)=>localStorage.getItem(k), devKeys1[0]);
      console.log('Dev battle (page1):', raw && raw.slice(0,200));
    }
    const keys2 = await page2.evaluate(() => Object.keys(localStorage));
    console.log('localStorage keys (page2):', keys2.slice(0,20));
    const devKeys2 = keys2.filter(k=>k.startsWith('dev_battle_'));
    if (devKeys2.length>0) {
      const raw2 = await page2.evaluate((k)=>localStorage.getItem(k), devKeys2[0]);
      console.log('Dev battle (page2):', raw2 && raw2.slice(0,200));
    }
      const body2 = await page2.content();
      console.log('PAGE2 HTML SNIPPET:\n', body2.slice(0,5000));
      const hasModal = await page2.$('text=¡TE HAN RETADO!');
      console.log('page2 has pending modal element?', !!hasModal);

    // En page2 debe aparecer el pendingChallenge; esperar y aceptar
    await page2.waitForSelector('text=¡ACEPTAR!', { timeout: 15000 });
    await page2.click('text=¡ACEPTAR!');
    await page2.waitForTimeout(200);
    const keysAfter = await page2.evaluate(() => Object.keys(localStorage));
    console.log('localStorage keys after accept (page2):', keysAfter.slice(0,20));
    const devKeysAfter = keysAfter.filter(k=>k.startsWith('dev_battle_'));
    if (devKeysAfter.length>0) {
      const rawA = await page2.evaluate((k)=>localStorage.getItem(k), devKeysAfter[0]);
      console.log('Dev battle after accept (page2):', rawA && rawA.slice(0,400));
    }

    await page1.waitForSelector('[data-test="battle-screen"]', { timeout: 30000 });
    await page2.waitForSelector('[data-test="battle-screen"]', { timeout: 30000 });
    const battleScreen1 = await page1.$('[data-test="battle-screen"]');
    const battleScreen2 = await page2.$('[data-test="battle-screen"]');
    console.log('battle screen present page1:', !!battleScreen1, 'page2:', !!battleScreen2);
    await page1.waitForSelector('[data-test="battle-round"]', { timeout: 30000 });
    await page2.waitForSelector('[data-test="battle-round"]', { timeout: 30000 });
    await page1.waitForSelector('[data-test="battle-question"]', { timeout: 30000 });
    await page2.waitForSelector('[data-test="battle-question"]', { timeout: 30000 });
    await page1.waitForSelector('[data-test="battle-option"]', { timeout: 30000 });
    await page2.waitForSelector('[data-test="battle-option"]', { timeout: 30000 });

    // Helper para responder preguntas intentando calcular aritmética
    const answerOnce = async (page, maxAttempts = 1) => {
      for (let a = 0; a < maxAttempts; a++) {
        const qEl = await page.$('[data-test="battle-question"]');
        if (!qEl) { await page.waitForTimeout(200); continue; }
        const qText = (await qEl.innerText()).trim();
          // Si es una pregunta puzzle, usar su flujo
          const isPuzzle = await page.$('[data-test="puzzle-question"]');
          if (isPuzzle) {
            try {
              const frags = await page.$$('[data-test="puzzle-fragment"]');
              for (let f of frags) {
                const disabled = await f.getAttribute('disabled');
                if (!disabled) await f.click();
              }
              const submit = await page.$('[data-test="puzzle-submit"]');
              if (submit) await submit.click();
            } catch(e) {}
            // wait briefly for state change
            await page.waitForTimeout(200);
            return;
          }

          await page.waitForSelector('[data-test="battle-option"]:not([disabled])', { timeout: 30000 });
          const options = page.locator('[data-test="battle-option"]:not([disabled])');
        const optionCount = await options.count();
        if (optionCount === 0) {
          await page.waitForTimeout(200);
          continue;
        }

        const optionTexts = [];
        for (let i = 0; i < optionCount; i++) {
          try { optionTexts.push((await options.nth(i).innerText()).trim()); } catch(e){ optionTexts.push(''); }
        }
        console.log('answerOnce:', { qText, optionCount, optionTexts });

        // parse
        let expected = null;
        const plusMatch = qText.match(/(\d+)\s*[+\+]\s*(\d+)(?:\s*[+\+]\s*(\d+))?/);
        const timesMatch = qText.match(/(\d+)\s*[×x\*]\s*(\d+)/);
        const minusMatch = qText.match(/(\d+)\s*-\s*(\d+)/);
        const divMatch = qText.match(/(\d+)\s*[÷/]\s*(\d+)/);
        if (plusMatch) expected = Number(plusMatch[1]) + Number(plusMatch[2]) + (plusMatch[3]?Number(plusMatch[3]):0);
        else if (timesMatch) expected = Number(timesMatch[1]) * Number(timesMatch[2]);
        else if (minusMatch) expected = Number(minusMatch[1]) - Number(minusMatch[2]);
        else if (divMatch) expected = Math.floor(Number(divMatch[1]) / Number(divMatch[2]));

        let clicked = false;
        if (expected !== null) {
          const exp = String(expected);
          for (let i = 0; i < optionCount; i++) {
            if (optionTexts[i] === exp) {
              await options.nth(i).click();
              clicked = true;
              break;
            }
          }
        }
        if (!clicked) {
          await options.first().click();
          clicked = true;
        }

        // Wait for the next available question or the options to become enabled again.
        await page.waitForFunction(
          ({ previousText }) => {
            const q = document.querySelector('[data-test="battle-question"]');
            if (!q) return false;
            if (q.innerText.trim() !== previousText) return true;
            return !!document.querySelector('[data-test="battle-option"]:not([disabled])');
          },
          { previousText: qText },
          { timeout: 5000 }
        ).catch(() => {});

        return;
      }
    };

    // Página1 responde 30 preguntas rápidamente
    for (let i=0;i<30;i++) {
      await answerOnce(page1, 3);
      await page1.waitForTimeout(20);
    }

    // Esperar un momento y comprobar que page2 todavía está en 'battle' (no pasó a 'battle_over')
    await page2.waitForTimeout(2000);
    const over1 = await page1.$('text=Volver al Menú');
    const over2 = await page2.$('text=Volver al Menú');
    if (over1) console.log('page1 already battle over'); else console.log('page1 still in battle (expected)');
    if (over2) console.log('page2 already battle over'); else console.log('page2 still in battle (expected)');

    // Ahora page2 responde las restantes hasta 30
    for (let i=0;i<30;i++) {
      await answerOnce(page2, 3);
      await page2.waitForTimeout(20);
    }

    const battleKey = (await page2.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('dev_battle_'))));
    if (battleKey) {
      const battleData = await page2.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), battleKey);
      console.log('Final battle state page2:', { status: battleData.status, player1Done: battleData.player1?.done, player2Done: battleData.player2?.done });
    }

    const battleKey1 = (await page1.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('dev_battle_'))));
    if (battleKey1) {
      const battleData1 = await page1.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), battleKey1);
      console.log('Final battle state page1:', { status: battleData1.status, player1Done: battleData1.player1?.done, player2Done: battleData1.player2?.done });
    }

    // Esperar a que ambos muestren battle over
    await page1.waitForSelector('text=Volver al Menú', { timeout: 15000 });
    await page2.waitForSelector('text=Volver al Menú', { timeout: 15000 });

    console.log('Batalla finalizada en ambas páginas. Test OK.');
  } catch (e) {
    console.error('Error test batalla:', e);
  } finally {
    await browser.close();
  }
})();
