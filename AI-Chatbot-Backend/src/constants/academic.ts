/**
 * NCTB-aligned question type catalogue (20 types).
 * The key is stored on every Question document; the label is shown in the UI.
 */
export interface QuestionTypeMeta {
  key: string;
  label: string;
  shortLabel: string;
  group: 'mcq' | 'fill' | 'match' | 'written' | 'language' | 'science' | 'visual' | 'ict' | 'math' | 'table';
  /** How the answer editor should render this type. */
  answerMode: 'options' | 'text' | 'pairs' | 'blanks' | 'table' | 'labels';
  description: string;
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  {
    key: 'single_mcq',
    label: 'Single-choice MCQ',
    shortLabel: 'MCQ',
    group: 'mcq',
    answerMode: 'options',
    description: 'One correct option out of several choices.',
  },
  {
    key: 'multi_mcq',
    label: 'Multiple-variable MCQ',
    shortLabel: 'Multi MCQ',
    group: 'mcq',
    answerMode: 'options',
    description: 'More than one option is correct.',
  },
  {
    key: 'passage_mcq',
    label: 'Passage-based MCQ',
    shortLabel: 'Passage MCQ',
    group: 'mcq',
    answerMode: 'options',
    description: 'Questions based on a shared passage or stem.',
  },
  {
    key: 'fill_blanks_clue',
    label: 'Fill in the blanks (with clues)',
    shortLabel: 'Blanks + clue',
    group: 'fill',
    answerMode: 'blanks',
    description: 'Fill blanks with the help of a clue or word bank.',
  },
  {
    key: 'fill_blanks_no_clue',
    label: 'Fill in the blanks (no clues)',
    shortLabel: 'Blanks',
    group: 'fill',
    answerMode: 'blanks',
    description: 'Fill blanks without any clue.',
  },
  {
    key: 'true_false',
    label: 'True or False',
    shortLabel: 'True/False',
    group: 'mcq',
    answerMode: 'options',
    description: 'Decide whether a statement is true or false.',
  },
  {
    key: 'matching',
    label: 'Matching Column A with Column B',
    shortLabel: 'Matching',
    group: 'match',
    answerMode: 'pairs',
    description: 'Match items from Column A with Column B.',
  },
  {
    key: 'short_answer',
    label: 'One-word or one-sentence answer',
    shortLabel: 'Short answer',
    group: 'written',
    answerMode: 'text',
    description: 'Answer using a single word or a short sentence.',
  },
  {
    key: 'choose_correct_word',
    label: 'Choose the correct word',
    shortLabel: 'Correct word',
    group: 'language',
    answerMode: 'options',
    description: 'Choose the correct word from the given options.',
  },
  {
    key: 'rearrange_words',
    label: 'Rearrange jumbled words',
    shortLabel: 'Rearrange',
    group: 'language',
    answerMode: 'text',
    description: 'Rearrange jumbled words to form a correct sentence.',
  },
  {
    key: 'bengali_conjunct',
    label: 'Bengali conjunct breakdown / word formation',
    shortLabel: 'Conjunct',
    group: 'language',
    answerMode: 'text',
    description: 'Break a Bengali conjunct or form words from letters.',
  },
  {
    key: 'synonyms_antonyms',
    label: 'Synonyms and Antonyms',
    shortLabel: 'Syn/Ant',
    group: 'language',
    answerMode: 'options',
    description: 'Identify synonyms or antonyms of a word.',
  },
  {
    key: 'grammar_application',
    label: 'Prepositions, Articles and Right Forms of Verbs',
    shortLabel: 'Grammar',
    group: 'language',
    answerMode: 'blanks',
    description: 'Apply grammar rules to complete or correct sentences.',
  },
  {
    key: 'science_formula_unit',
    label: 'Scientific formula, value and unit matching',
    shortLabel: 'Formula/Unit',
    group: 'science',
    answerMode: 'pairs',
    description: 'Match a formula with its value or unit.',
  },
  {
    key: 'diagram_label',
    label: 'Diagram and picture labeling',
    shortLabel: 'Diagram',
    group: 'visual',
    answerMode: 'labels',
    description: 'Label parts of a diagram or picture.',
  },
  {
    key: 'geometry_identify',
    label: 'Geometric shape and angle identification',
    shortLabel: 'Geometry',
    group: 'visual',
    answerMode: 'options',
    description: 'Identify shapes, angles or geometric properties.',
  },
  {
    key: 'ict_classification',
    label: 'ICT shortcut keys and input/output device classification',
    shortLabel: 'ICT',
    group: 'ict',
    answerMode: 'pairs',
    description: 'Match shortcuts or classify input/output devices.',
  },
  {
    key: 'history_geo_match',
    label: 'Historical dates, years and geographical matching',
    shortLabel: 'History/Geo',
    group: 'match',
    answerMode: 'pairs',
    description: 'Match events, dates, years or places.',
  },
  {
    key: 'math_symbol',
    label: 'Mathematical symbol selection (>, <, =)',
    shortLabel: 'Math symbol',
    group: 'math',
    answerMode: 'options',
    description: 'Choose the correct comparison or operation symbol.',
  },
  {
    key: 'table_completion',
    label: 'Table and chart completion',
    shortLabel: 'Table',
    group: 'table',
    answerMode: 'table',
    description: 'Complete a table or chart with the missing information.',
  },
];

export const QUESTION_TYPE_KEYS = QUESTION_TYPES.map((type) => type.key) as [string, ...string[]];

export function questionTypeMeta(key: string): QuestionTypeMeta | undefined {
  return QUESTION_TYPES.find((type) => type.key === key);
}

export const SCHOOL_TYPES = ['school', 'coaching', 'individual'] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const ASSESSMENT_TYPES = ['quiz', 'assignment', 'exam'] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const MATERIAL_TYPES = ['note', 'exam_sheet', 'syllabus', 'worksheet', 'other'] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const QUESTION_STATUSES = ['draft', 'published', 'archived'] as const;
export const ASSESSMENT_STATUSES = ['draft', 'published', 'closed'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
