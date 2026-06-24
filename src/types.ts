export type TaskStatus = '1' | '2' | '3' | '4';

export type Task = {
  id: string;
  status: TaskStatus;
};

export type Column = {
  id: TaskStatus;
  title: string;
};
