import React from 'react';
import PuzzleQuestion from './PuzzleQuestion';
import { action } from '@storybook/addon-actions';

export default {
  title: 'Components/PuzzleQuestion',
  component: PuzzleQuestion,
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
  return <PuzzleQuestion question={question} onSubmit={action('submit')} />;
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
