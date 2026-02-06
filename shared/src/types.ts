export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoChangedPayload {
  totalCount: number;
  openCount: number;
}

export interface TodoCreatedPayload {
  todo: Todo;
}
