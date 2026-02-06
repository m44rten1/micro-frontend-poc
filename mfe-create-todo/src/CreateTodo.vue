<script setup lang="ts">
import { ref } from 'vue';
import type { Todo, TodoCreatedPayload } from '@mfe/shared/types';
import { TODO_CREATED } from '@mfe/shared/events';

const text = ref('');
const isSubmitting = ref(false);

async function handleSubmit() {
  const trimmed = text.value.trim();
  if (!trimmed || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    const res = await fetch('http://localhost:3004/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { todo } = (await res.json()) as { todo: Todo };

    const payload: TodoCreatedPayload = { todo };
    window.dispatchEvent(new CustomEvent(TODO_CREATED, { detail: payload }));

    text.value = '';
  } catch (err) {
    console.error('[mfe-create-todo] Failed to create todo:', err);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <form class="create-todo" @submit.prevent="handleSubmit">
    <input
      v-model="text"
      type="text"
      class="create-todo__input"
      placeholder="What needs to be done?"
    />
    <button
      type="submit"
      class="create-todo__button"
      :disabled="isSubmitting"
    >
      Add Todo
    </button>
  </form>
</template>
