import { Type, type FunctionDeclaration } from '@google/genai';

export const updateStatusDeclaration: FunctionDeclaration = {
  name: 'updateStatus',
  description: 'Update the project lifecycle status.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        enum: ['draft', 'in_progress', 'blocked', 'completed'],
        description: 'The target status for the project.',
      },
    },
    required: ['status'],
  },
};

export const renameProjectDeclaration: FunctionDeclaration = {
  name: 'renameProject',
  description: 'Update the title of the project.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'The new title for the project.',
      },
    },
    required: ['title'],
  },
};

export const updateDescriptionDeclaration: FunctionDeclaration = {
  name: 'updateDescription',
  description: 'Update the textual description of the project.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: 'The updated description content.',
      },
    },
    required: ['description'],
  },
};

export const addTagDeclaration: FunctionDeclaration = {
  name: 'addTag',
  description: 'Add a new tag to the project tags list.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tag: {
        type: Type.STRING,
        description: 'The tag string to add to the project.',
      },
    },
    required: ['tag'],
  },
};

export const removeTagDeclaration: FunctionDeclaration = {
  name: 'removeTag',
  description: 'Remove an existing tag from the project tags list.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tag: {
        type: Type.STRING,
        description: 'The tag string to remove.',
      },
    },
    required: ['tag'],
  },
};

export const allToolDeclarations: FunctionDeclaration[] = [
  updateStatusDeclaration,
  renameProjectDeclaration,
  updateDescriptionDeclaration,
  addTagDeclaration,
  removeTagDeclaration,
];
