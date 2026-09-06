export type ClassResourceType = "zoom_url" | "material_url" | "other_url";
export type ClassTaskStatus = "todo" | "submitted" | "skipped";

export type ClassResourceDto = {
  id: string;
  type: ClassResourceType;
  title: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassTaskDto = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: ClassTaskStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type ClassMemoDto = {
  classId: string;
  body: string;
  updatedAt: string | null;
};

export type ClassTagDto = {
  id: string;
  classId: string;
  label: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};
