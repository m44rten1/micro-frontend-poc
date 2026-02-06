import { defineComponent, h, ref, onMounted, onUnmounted, type PropType } from 'vue';
import type { Todo, TodoCreatedPayload, TodoChangedPayload } from '@mfe/shared/types';
import { TODO_CREATED, TODO_CHANGED } from '@mfe/shared/events';

export default defineComponent({
  name: 'TodoList',

  props: {
    initialTodos: {
      type: Array as PropType<Todo[]>,
      required: true,
    },
  },

  setup(props) {
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
        await fetch(`http://localhost:3002/api/todos/${id}/toggle`, { method: 'PATCH' });
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

    // ── Render ──

    return () =>
      h('div', { class: 'todo-list' }, [
        todos.value.length === 0
          ? h('p', { class: 'todo-list__empty' }, 'No todos yet. Add one above!')
          : h(
              'ul',
              { class: 'todo-list__items' },
              todos.value.map((todo) =>
                h(
                  'li',
                  {
                    class: [
                      'todo-list__item',
                      todo.done ? 'todo-list__item--done' : '',
                    ],
                    key: todo.id,
                  },
                  [
                    h('label', { class: 'todo-list__label' }, [
                      h('input', {
                        type: 'checkbox',
                        checked: todo.done,
                        class: 'todo-list__checkbox',
                        onChange: () => toggle(todo.id),
                      }),
                      h('span', { class: 'todo-list__text' }, todo.text),
                    ]),
                  ]
                )
              )
            ),
      ]);
  },
});
