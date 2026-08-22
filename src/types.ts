export type TaskStatus = '1' | '2' | '3' | '4';

export type Task = {
  id: string;
  status: TaskStatus;
  image: string;
  name: string;
  title: string;
  details: string[];
  veteranLogo: string | null;
};

export type Column = {
  id: TaskStatus;
  title: string;
};
