import React from "react";
import Chatbot from "./components/Chatbot";
import "./App.css"; // Nếu có style mặc định thì có thể xóa hoặc giữ

const App: React.FC = () => {
  return (
    <div className="App">
      <Chatbot />
    </div>
  );
};

export default App;
