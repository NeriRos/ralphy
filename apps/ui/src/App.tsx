import { Routes, Route } from "react-router-dom";
import { SidecarProvider } from "./context/SidecarContext";
import { TaskListView } from "./views/TaskListView";
import { TaskDetailView } from "./views/TaskDetailView";
import { NewTaskView } from "./views/NewTaskView";

export function App() {
  return (
    <SidecarProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<TaskListView />} />
          <Route path="/tasks/new" element={<NewTaskView />} />
          <Route path="/tasks/:name" element={<TaskDetailView />} />
        </Routes>
      </div>
    </SidecarProvider>
  );
}
