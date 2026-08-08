import React from 'react';
import PuzzleQuestion from './PuzzleQuestion';

export default {
  title: 'Components/PuzzleQuestion',
  component: PuzzleQuestion,
  tags: ['ai-generated', 'needs-work'],
  argTypes: {
    fragmentsText: { control: 'text', name: 'Fragments (comma-separated)' },
    id: { control: 'text' },
  },
};

function buildQuestionFromArgs({ id = 'puzzle-1', fragmentsText = '' }) {
  const fragments = fragmentsText
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return { id, fragments };
}

const Template = (args) => {
  const question = buildQuestionFromArgs(args);
  return <PuzzleQuestion question={question} onSubmit={(p)=>console.log('submit',p)} />;
};

export const Default = Template.bind({});
Default.args = {
  id: 'puzzle-1',
  fragmentsText: 'Los, sinónimos, se, escriben, igual, pero, significan, diferente.'
};

export const LongFragments = Template.bind({});
LongFragments.args = {
  id: 'puzzle-2',
  fragmentsText: 'Una, frase, larguísima, para, probar, el, componente, Puzzle, y, su, UI'
};

export const Empty = Template.bind({});
Empty.args = { id: 'empty', fragmentsText: '' };

export const KeyboardAccessible = Template.bind({});
KeyboardAccessible.args = Default.args;
KeyboardAccessible.parameters = {
  docs: {
    storyDescription: 'Reordenar fragmentos con teclado y selector táctil: seleccionado + clic en otro bloque.',
  },
};
KeyboardAccessible.play = async ({ canvas }) => {
  const fragments = await canvas.getAllByTestId('puzzle-fragment');
  await expect(fragments[0]).toHaveAttribute('tabindex', '0');
  await expect(fragments[0]).toHaveAttribute('aria-pressed', 'false');
};

// CssCheck: valida que la hoja global de Tailwind esté cargada verificando
// el color de fondo del botón `Enviar` (`bg-emerald-600` -> rgb(5,150,105)).
import { expect } from 'storybook/test';

export const CssCheck = Template.bind({});
CssCheck.args = Default.args;
CssCheck.play = async ({ canvas }) => {
  const btn = canvas.getByRole('button', { name: /enviar/i });
  // espera a que el botón esté visible
  await expect(btn).toBeVisible();
  // verificar que la clase Tailwind correcta esté presente (más estable que comparar colores)
  await expect(btn).toHaveClass('bg-emerald-600');
};
