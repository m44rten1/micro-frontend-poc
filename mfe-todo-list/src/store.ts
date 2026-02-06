import type { Todo } from '@mfe/shared/types';

// ── In-memory todo store (owned by this micro-frontend) ──

let nextId = 4;

const todos: Todo[] = [
  { id: '1', text: 'Buy groceries', done: false },
  { id: '2', text: 'Read a book', done: true },
  { id: '3', text: 'Build micro-frontend POC', done: false },
];

export function getAllTodos(): Todo[] {
  return [...todos];
}

export function addTodo(text: string): Todo {
  const todo: Todo = { id: String(nextId++), text, done: false };
  todos.push(todo);
  return todo;
}

export function toggleTodo(id: string): Todo | undefined {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.done = !todo.done;
  }
  return todo;
}

export function getOpenCount(): number {
  return todos.filter((t) => !t.done).length;
}

export function getTotalCount(): number {
  return todos.length;
}
