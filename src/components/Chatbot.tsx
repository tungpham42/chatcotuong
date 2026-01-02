import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Layout,
  Input,
  Button,
  List,
  Avatar,
  Card,
  Spin,
  message,
  Popconfirm,
  Menu,
  Drawer,
  Tag,
  Tooltip,
} from "antd";
import {
  SendOutlined,
  AudioOutlined,
  StopOutlined,
  DeleteOutlined,
  PlusOutlined,
  MessageOutlined,
  MenuOutlined,
  InboxOutlined,
  ThunderboltFilled,
  CheckCircleOutlined,
  TrophyFilled,
  FireFilled, // New icon for User
  ReadFilled, // New icon for AI
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const { Header, Content, Footer, Sider } = Layout;
const { TextArea } = Input;

// --- TYPES ---
type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: number;
};

const Chatbot: React.FC = () => {
  // --- CẤU HÌNH ---
  const STORAGE_KEY = "cotuong_chat_sessions_v2"; // Updated key to avoid conflict with old theme
  const SILENCE_TIMEOUT = 2000;

  const INITIAL_SYSTEM_MSG: Message = useMemo(
    () => ({
      role: "system",
      content:
        "Bạn là Trợ lý Cờ Tướng (Xiangqi AI) của website cotuong.top. Bạn có kiến thức sâu rộng về khai cuộc, trung cuộc, tàn cuộc và các danh thủ cờ tướng. Phong cách trả lời: Điềm tĩnh, chiến lược, ngắn gọn và sâu sắc như một kỳ thủ lão luyện. Luôn xưng hô là 'Tôi' hoặc 'Kỳ đài'.",
    }),
    []
  );

  // --- STATE ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.filter((s: ChatSession) => s.messages.length > 1);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [usedModel, setUsedModel] = useState<string>("Grandmaster Mode");

  // --- REFS ---
  const recognitionRef = useRef<any>(null);
  const silenceTimer = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // --- HELPERS ---
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus({
        cursor: "end",
      });
    }, 100);
  };

  const currentMessages = useMemo(
    () =>
      sessions.find((s) => s.id === currentSessionId)?.messages || [
        INITIAL_SYSTEM_MSG,
      ],
    [sessions, currentSessionId, INITIAL_SYSTEM_MSG]
  );

  // --- EFFECTS ---

  useEffect(() => {
    focusInput();
  }, []);

  useEffect(() => {
    const scriptId = "google-adsense-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3585118770961536";
      script.async = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const validSessions = sessions.filter((s) => s.messages.length > 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validSessions));
  }, [sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isListening]);

  useEffect(() => {
    if (sessions.length === 0 && !currentSessionId) {
      const newId = generateId();
      const newSession: ChatSession = {
        id: newId,
        title: "Ván cờ mới",
        messages: [INITIAL_SYSTEM_MSG],
        lastUpdated: Date.now(),
      };
      setSessions([newSession]);
      setCurrentSessionId(newId);
    } else if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId, INITIAL_SYSTEM_MSG]);

  // --- ACTIONS ---
  const handleNewChat = () => {
    const currentS = sessions.find((s) => s.id === currentSessionId);
    if (currentS && currentS.messages.length <= 1) {
      setDrawerVisible(false);
      message.info("Kỳ đài đã sẵn sàng, hãy đặt câu hỏi.");
      focusInput();
      return;
    }

    const cleanSessions = sessions.filter((s) => s.messages.length > 1);
    const newSession: ChatSession = {
      id: generateId(),
      title: "Ván cờ mới",
      messages: [INITIAL_SYSTEM_MSG],
      lastUpdated: Date.now(),
    };

    setSessions([newSession, ...cleanSessions]);
    setCurrentSessionId(newSession.id);
    setUsedModel("Grandmaster Mode");
    setDrawerVisible(false);
    focusInput();
    if (window.innerWidth < 768) message.success("Đã mở trang cờ mới");
  };

  const handleSelectSession = (targetId: string) => {
    const cleanSessions = sessions.filter(
      (s) => s.id === targetId || s.messages.length > 1
    );
    setSessions(cleanSessions);
    setCurrentSessionId(targetId);
    setDrawerVisible(false);
    focusInput();
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter((s) => s.id !== id);
    setSessions(newSessions);

    if (id === currentSessionId) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      } else {
        const newId = generateId();
        const newSession: ChatSession = {
          id: newId,
          title: "Ván cờ mới",
          messages: [INITIAL_SYSTEM_MSG],
          lastUpdated: Date.now(),
        };
        setSessions([newSession]);
        setCurrentSessionId(newId);
      }
    }
    message.success("Đã xóa lịch sử");
    focusInput();
  };

  const handleSend = async (manualText?: string) => {
    const contentToSend =
      typeof manualText === "string" ? manualText : inputValue;
    if (!contentToSend.trim()) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    }

    if (!currentSessionId) return;

    const newUserMsg: Message = { role: "user", content: contentToSend };

    const updatedSessions = sessions.map((s) => {
      if (s.id === currentSessionId) {
        const newTitle =
          s.title === "Ván cờ mới"
            ? contentToSend.slice(0, 30) +
              (contentToSend.length > 30 ? "..." : "")
            : s.title;
        return {
          ...s,
          title: newTitle,
          messages: [...s.messages, newUserMsg],
          lastUpdated: Date.now(),
        };
      }
      return s;
    });

    updatedSessions.sort((a, b) => b.lastUpdated - a.lastUpdated);

    setSessions(updatedSessions);
    setInputValue("");
    setLoading(true);

    try {
      const currentHistory =
        updatedSessions.find((s) => s.id === currentSessionId)?.messages || [];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();

      if (data.usedModel) {
        setUsedModel(data.usedModel);
      }

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: [
                ...s.messages,
                { role: "assistant", content: data.content },
              ],
            };
          }
          return s;
        })
      );
    } catch (error) {
      message.error("Lỗi kết nối.");
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: [
                ...s.messages,
                {
                  role: "assistant",
                  content: "♟️ **Lỗi:** Không thể kết nối tới máy chủ cờ.",
                },
              ],
            };
          }
          return s;
        })
      );
    } finally {
      setLoading(false);
      focusInput();
    }
  };

  // --- VOICE ---
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      message.error("Trình duyệt không hỗ trợ.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result) => result.transcript)
        .join("");
      setInputValue(transcript);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        recognition.stop();
        handleSend(transcript);
      }, SILENCE_TIMEOUT);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const SidebarContent = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--sider-bg)",
      }}
    >
      <div style={{ padding: "20px" }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          size="large"
          className="new-chat-btn"
          onClick={handleNewChat}
        >
          Ván Mới
        </Button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
        <div className="history-label">Lịch sử đấu</div>
        <Menu
          mode="inline"
          selectedKeys={[currentSessionId || ""]}
          style={{ borderRight: 0, background: "transparent" }}
        >
          {sessions
            .filter((s) => s.messages.length > 1 || s.id === currentSessionId)
            .map((session) => (
              <Menu.Item
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className="history-item"
                style={{
                  height: "auto",
                  lineHeight: "1.5",
                  padding: "10px 15px",
                  marginBottom: 5,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <MessageOutlined style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flex: 1,
                      }}
                    >
                      {session.title}
                    </span>
                  </div>
                  <Popconfirm
                    title="Xóa ván này?"
                    onConfirm={(e: any) => handleDeleteSession(e, session.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Button
                      type="text"
                      size="small"
                      className="delete-session-btn"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flexShrink: 0, marginLeft: 8 }}
                    />
                  </Popconfirm>
                </div>
              </Menu.Item>
            ))}
        </Menu>
      </div>
    </div>
  );

  return (
    <Layout style={{ height: "100dvh", overflow: "hidden" }}>
      <Sider
        width={280}
        className="desktop-sider"
        theme="dark" // AntD dark theme for Sidebar
        breakpoint="md"
        collapsedWidth="0"
        trigger={null}
      >
        <SidebarContent />
      </Sider>

      <Drawer
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        <SidebarContent />
      </Drawer>

      <Layout className="site-layout" style={{ height: "100%" }}>
        <Header className="chatbot-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 15,
              overflow: "hidden",
            }}
          >
            <Button
              className="mobile-menu-btn"
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerVisible(true)}
            />
            <div className="logo-circle">
              <TrophyFilled style={{ fontSize: 20 }} />
            </div>
            <div className="header-title">Trợ Lý Cờ Tướng</div>
          </div>
          <div className="desktop-only-item">
            <Tooltip title={`Engine: ${usedModel}`}>
              <Tag
                icon={
                  usedModel === "Ready" ? (
                    <CheckCircleOutlined />
                  ) : (
                    <ThunderboltFilled />
                  )
                }
                color={usedModel === "Ready" ? "default" : "error"} // Red tag for chess theme
                style={{
                  margin: 0,
                  padding: "4px 10px",
                  borderRadius: 4,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontWeight: 600,
                }}
              >
                {usedModel === "Ready" ? "Sẵn sàng" : usedModel}
              </Tag>
            </Tooltip>
          </div>
        </Header>

        <Content className="chatbot-content" style={{ overflowY: "auto" }}>
          {currentMessages.length === 1 && (
            <div className="welcome-screen">
              <div className="welcome-icon">
                <TrophyFilled style={{ fontSize: 36, color: "#d63031" }} />
              </div>
              <h2>Chào mừng kỳ thủ!</h2>
              <p>Bạn muốn tìm hiểu về khai cuộc hay giải cờ thế hôm nay?</p>
            </div>
          )}

          <List
            locale={{
              emptyText: (
                <div style={{ padding: "20px 0", color: "#636e72" }}>
                  <InboxOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <div style={{ fontFamily: "Be Vietnam Pro", fontSize: 12 }}>
                    Trống quân. Hãy đi nước đầu tiên.
                  </div>
                </div>
              ),
            }}
            dataSource={currentMessages.filter((m) => m.role !== "system")}
            split={false}
            renderItem={(item) => (
              <div
                className={`message-row ${
                  item.role === "user" ? "user" : "ai"
                }`}
              >
                {item.role === "assistant" && (
                  <Avatar
                    className="avatar-ai"
                    size={42}
                    shape="square" // Square avatar for "Board" feel
                    icon={<ReadFilled />}
                  />
                )}
                <Card className="message-card">
                  <div className="markdown-body">
                    {item.role === "assistant" ? (
                      <ReactMarkdown
                        rehypePlugins={[rehypeRaw]}
                        remarkPlugins={[remarkGfm]}
                      >
                        {item.content}
                      </ReactMarkdown>
                    ) : (
                      <span>{item.content}</span>
                    )}
                  </div>
                </Card>
                {item.role === "user" && (
                  <Avatar
                    className="avatar-user"
                    size={42}
                    shape="circle" // Circle avatar for "Piece" feel
                    icon={<FireFilled />} // Red side fire
                  />
                )}
              </div>
            )}
          />

          {isListening && (
            <div className="listening-indicator">
              <span className="pulsing-mic">●</span> Đang nghe lệnh...
            </div>
          )}
          {loading && (
            <div className="loading-indicator">
              <Spin
                indicator={
                  <FireFilled
                    style={{ fontSize: 14, color: "#d63031", marginRight: 8 }}
                    spin
                  />
                }
              />
              Đang tính nước đi...
            </div>
          )}
          <div ref={bottomRef} />
        </Content>

        <Footer className="chatbot-footer" style={{ height: "auto" }}>
          <div className="input-container">
            <Button
              type="text"
              shape="circle"
              onClick={toggleListening}
              className={isListening ? "mic-btn-active" : "mic-btn"}
              icon={
                isListening ? (
                  <StopOutlined />
                ) : (
                  <AudioOutlined style={{ fontSize: 18 }} />
                )
              }
            />
            <TextArea
              value={inputValue}
              ref={inputRef}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nhập nước đi hoặc câu hỏi..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="custom-textarea"
              disabled={loading}
            />
            <Button
              type="primary"
              onClick={() => handleSend()}
              loading={loading}
              className="send-btn"
              icon={
                <SendOutlined
                  style={{
                    fontSize: 20,
                    marginLeft: loading ? 0 : 3,
                    color: "#fff",
                  }}
                />
              }
            />
          </div>
        </Footer>
      </Layout>
    </Layout>
  );
};

export default Chatbot;
