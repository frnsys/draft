import React from 'react';

type Message = {
  id: number,
  type: string,
  body: string,
}
type Task = {
  id: number,
  name: string,
  progress: number,
}
type Messages = {[id:number]: Message};
type Tasks = {[id:number]: Task};
type CtxValue = {
  messages: Messages,
  tasks: Tasks,
  addMessage: (type: string, body: string, timeout?: number) => number,
  dismissMessage: (id: number) => void,
  addTask: (name: string, progress?: boolean) => number,
  updateTask: (id: number, progress: number) => void,
  finishTask: (id: number) => void,
}
const StatusContext = React.createContext<CtxValue>(null);

export const getStatus = () => React.useContext(StatusContext);

export function StatusProvider({children}: {children: JSX.Element}) {
  const [messages, setMessages] = React.useState<Messages>({});
  const [tasks, setTasks] = React.useState<Tasks>({});

  const addMessage = (type: string, body: string, timeout?: number) : number => {
    let id = Date.now();
    setMessages((messages) => {
      return {
        [id]: {id, type, body},
        ...messages
      }
    });

    if (timeout) {
      setTimeout(() => {
        dismissMessage(id);
      }, timeout * 1000);
    }
    return id;
  }

  const dismissMessage = (id: number) => {
    setMessages((messages) => {
      let msgs = {...messages};
      delete msgs[id];
      return msgs;
    });
  }

  const addTask = (name: string, progress=false) : number => {
    let id = Date.now();
    setTasks((tasks) => {
      return {
        [id]: {id, name, progress: progress ? 0 : -1},
        ...tasks
      }
    });
    return id;
  }

  const updateTask = (id: number, progress: number) => {
    setTasks((tasks) => {
      let tsks = {...tasks};
      if (progress >= 1) {
        delete tsks[id];
      } else {
        tsks[id].progress = progress;
      }
      return tsks;
    });
  }

  const finishTask = (id: number) => {
    updateTask(id, 1);
  }

  const ctxValue = {
    tasks,
    messages,
    addMessage,
    dismissMessage,
    addTask,
    updateTask,
    finishTask,
  };

  return <StatusContext.Provider value={ctxValue}>
    {children}
  </StatusContext.Provider>
}

function Status() {
  const ctx = React.useContext(StatusContext);
  const messages = Object.values(ctx.messages);
  const tasks = Object.values(ctx.tasks);

  return <div id="status">
    <div id="status-messages">
      {messages.map((msg, i) => {
        return <div
          key={i}
          onClick={() => ctx.dismissMessage(msg.id)}
          className={`status-message ${msg.type}`}>{msg.body}</div>
      })}

      {tasks.map((task, i) => {
        let taskProgress = <img className="status-task-loading" src="/assets/icons/placeholder.gif" />
        if (task.progress >= 0) {
          let width = `${task.progress * 100}%`;
          taskProgress = <div className="status-task-bar">
            <div className="status-task-bar-fill" style={{width}}></div>
          </div>
        }
        return <div
          key={i}
          className="status-task" id={task.id.toString()}>
          {task.name}
          {taskProgress}
        </div>
      })}
    </div>
  </div>
}

export default Status;
