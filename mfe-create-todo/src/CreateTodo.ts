import { defineComponent, h, ref } from 'vue';
import type { Todo, TodoCreatedPayload } from '@mfe/shared/types';
import { TODO_CREATED } from '@mfe/shared/events';

export default defineComponent({
  name: 'CreateTodo',

  setup() {
    const text = ref('');
    const isSubmitting = ref(false);

    async function handleSubmit() {
      const trimmed = text.value.trim();
      if (!trimmed || isSubmitting.value) return;

      isSubmitting.value = true;
      try {
        const res = await fetch('http://localhost:3002/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { todo } = (await res.json()) as { todo: Todo };

        // Notify the todo-list MFE via window event
        const payload: TodoCreatedPayload = { todo };
        window.dispatchEvent(new CustomEvent(TODO_CREATED, { detail: payload }));

        text.value = '';
      } catch (err) {
        console.error('[mfe-create-todo] Failed to create todo:', err);
      } finally {
        isSubmitting.value = false;
      }
    }

    return () =>
      h(
        'form',
        {
          class: 'create-todo',
          onSubmit: (e: Event) => {
            e.preventDefault();
            handleSubmit();
          },
        },
        [
          h('input', {
            type: 'text',
            class: 'create-todo__input',
            placeholder: 'What needs to be done?',
            value: text.value,
            onInput: (e: Event) => {
              text.value = (e.target as HTMLInputElement).value;
            },
          }),
          h(
            'button',
            {
              type: 'submit',
              class: 'create-todo__button',
              disabled: isSubmitting.value,
            },
            'Add Todo'
          ),
        ]
      );
  },
});
