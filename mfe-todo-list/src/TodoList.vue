<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { Todo, TodoCreatedPayload, TodoChangedPayload } from '@mfe/shared/types';
import { TODO_CREATED, TODO_CHANGED } from '@mfe/shared/events';

const props = defineProps<{
  initialTodos: Todo[];
}>();

const todos = ref<Todo[]>([...props.initialTodos]);

// ── Emit count to header MFE via window event ──

function emitChanged() {
  const payload: TodoChangedPayload = {
    totalCount: todos.value.length,
    openCount: todos.value.filter((t) => !t.done).length,
  };
  window.dispatchEvent(new CustomEvent(TODO_CHANGED, { detail: payload }));
}

// ── Toggle a todo (API call + local state + notify) ──

async function toggle(id: string) {
  const todo = todos.value.find((t) => t.id === id);
  if (!todo) return;

  todo.done = !todo.done; // optimistic update
  emitChanged();

  try {
    await fetch(`http://localhost:3004/api/todos/${id}/toggle`, { method: 'PATCH' });
  } catch (err) {
    console.error('[mfe-todo-list] Toggle failed, reverting:', err);
    todo.done = !todo.done; // revert on failure
    emitChanged();
  }
}

// ── Listen for new todos from the create MFE ──

function handleTodoCreated(e: Event) {
  const { todo } = (e as CustomEvent<TodoCreatedPayload>).detail;
  todos.value.push(todo);
  emitChanged();
}

onMounted(() => {
  window.addEventListener(TODO_CREATED, handleTodoCreated);
  emitChanged(); // emit initial count after hydration
});

onUnmounted(() => {
  window.removeEventListener(TODO_CREATED, handleTodoCreated);
});
</script>

<template>
  <div class="todo-list">
    <p v-if="todos.length === 0" class="todo-list__empty">
      No todos yet. Add one above!
    </p>
    <ul v-else class="todo-list__items">
      <li
        v-for="todo in todos"
        :key="todo.id"
        :class="['todo-list__item', { 'todo-list__item--done': todo.done }]"
      >
        <label class="todo-list__label">
          <input
            type="checkbox"
            :checked="todo.done"
            class="todo-list__checkbox"
            @change="toggle(todo.id)"
          />
          <span class="todo-list__text">{{ todo.text }}</span>
        </label>
      </li>
    </ul>
  </div>
</template>
