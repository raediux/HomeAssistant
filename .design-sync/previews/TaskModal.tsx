import { TaskModal } from 'home-assistant-react';

const wrap = {
  minHeight: 400,
  background: '#111110',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function AddTask() {
  return (
    <div style={wrap}>
      <TaskModal modal={{ mode: 'add', person: 'Ray', frequency: 'daily' }} memberName="Ray" onConfirm={() => {}} onClose={() => {}} />
    </div>
  );
}

export function EditTask() {
  return (
    <div style={wrap}>
      <TaskModal
        modal={{ mode: 'edit', person: 'Jazelle', frequency: 'weekly', task: { id: 1, title: 'Clean bathroom', dueDate: null, dow: 1, done: false } }}
        memberName="Jazelle"
        onConfirm={() => {}}
        onClose={() => {}}
      />
    </div>
  );
}
