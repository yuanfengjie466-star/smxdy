import { useState, useRef, useEffect, useCallback } from "react";
import { useMultiModelChat } from "./hooks/useMultiModelChat";
import {
  Send,
  Square,
  Sparkles,
  User,
  Bot,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  ExternalLink,
  Lock,
  Unlock,
  Shield,
  AlertTriangle,
  Smartphone,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// API Key 仅保存在内存中，关闭网页即销毁
const LS_PWD_HASH = "sensenova_pwd_hash";
const LS_SALT = "sensenova_salt";

/* ===================== XSS Protection ===================== */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ===================== Crypto Helpers ===================== */

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* 二次加密：对 SHA-256 结果再做一次带盐扰动的哈希 */
async function doubleHash(password: string, salt: string): Promise<string> {
  const first = await sha256(password + salt);
  const mixed = first.slice(0, 32) + salt + first.slice(32);
  return sha256(mixed);
}

/* ===================== UI Components ===================== */

function TypingCursor() {
  return (
    <span className="inline-block w-2 h-5 bg-primary rounded-sm ml-0.5 animate-pulse align-middle" />
  );
}

function ImageWithFallback({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground border rounded-xl">
        <ImageOff className="w-5 h-5 mr-2" />
        <span className="text-xs">图片加载失败</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full max-w-md h-auto object-cover"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  if (!reasoning) return null;
  return (
    <div className="mb-3 rounded-lg bg-muted/60 border border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>思考过程 ({reasoning.length} 字符)</span>
        <span className="ml-auto">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-2">
          {reasoning}
        </div>
      )}
    </div>
  );
}

function formatContent(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let inCode = false;
  let codeBuffer: string[] = [];
  let listItems: string[] = [];
  let inList = false;

  // 使用内容哈希生成稳定 key，避免流式更新时 key 变化导致 DOM 复用错误
  const stableKey = (prefix: string, content: string) => 
    `${prefix}-${btoa(content).slice(0, 8)}`;

  const flushCode = () => {
    if (codeBuffer.length > 0) {
      const codeContent = codeBuffer.join("\n");
      elements.push(
        <pre
          key={stableKey("code", codeContent)}
          className="bg-muted rounded-lg p-3 overflow-x-auto text-sm my-2 font-mono leading-relaxed"
        >
          <code>{codeBuffer.map(escapeHtml).join("\n")}</code>
        </pre>
      );
      codeBuffer = [];
    }
    inCode = false;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const listContent = listItems.join("|");
      const listKey = stableKey("list", listContent);
      elements.push(
        <ul key={listKey} className="list-disc pl-5 my-2 space-y-1 text-sm">
          {listItems.map((item, i) => (
            <li key={stableKey("li", `${listKey}-${i}-${item}`)}>{escapeHtml(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      flushList();
      inList = true;
      listItems.push(line.trim().slice(2).trim());
      continue;
    }

    if (inList && line.trim() === "") {
      flushList();
      continue;
    }

    if (inList) {
      listItems.push(line.trim());
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={stableKey("br", `${i}-empty`)} className="h-2" />);
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={stableKey("h2", line)} className="text-lg font-bold mt-4 mb-2">
          {escapeHtml(line.slice(2))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={stableKey("h3", line)} className="text-base font-semibold mt-3 mb-1.5">
          {escapeHtml(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={stableKey("h4", line)} className="text-sm font-semibold mt-2 mb-1">
          {escapeHtml(line.slice(4))}
        </h4>
      );
      continue;
    }

    const bolded = line.split(/(\*\*.*?\*\*)/g).map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={stableKey("strong", part)}>{escapeHtml(part.slice(2, -2))}</strong>;
      }
      return escapeHtml(part);
    });

    elements.push(
      <p key={stableKey("p", line)} className="text-sm leading-relaxed my-1">
        {bolded}
      </p>
    );
  }

  flushCode();
  flushList();

  return <>{elements}</>;
}

/* ===================== Password Lock Screen ===================== */

function LockScreen({
  onUnlock,
}: {
  onUnlock: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const handleUnlock = async () => {
    const trimmed = pwd.trim();
    if (!trimmed) return;

    const salt = localStorage.getItem(LS_SALT);
    const storedHash = localStorage.getItem(LS_PWD_HASH);

    if (!salt || !storedHash) {
      setError("安全数据异常，请重新登录");
      return;
    }

    const inputHash = await doubleHash(trimmed, salt);
    if (inputHash === storedHash) {
      setError("");
      onUnlock();
    } else {
      setError("密码错误");
      setPwd("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleUnlock();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center px-4" translate="no">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-muted border flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">会话已锁定</h1>
            <p className="text-xs text-muted-foreground mt-1">
              检测到页面进入后台或切换窗口，已自动挂锁保护隐私
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              本地密码
            </label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={pwd}
                onChange={(e) => {
                  setPwd(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="请输入本地密码解锁"
                className="pr-10 h-11"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button className="w-full h-10" onClick={handleUnlock} disabled={!pwd.trim()}>
            <Unlock className="w-4 h-4 mr-2" />
            解锁
          </Button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-[11px] text-muted-foreground">
            密码经二次加密哈希后仅存于本地浏览器
          </p>
          <p className="text-[11px] text-muted-foreground">
            不会上传至任何云端或服务器
          </p>
        </div>
      </div>
    </div>
  );
}

/* ===================== Splash Screen ===================== */

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [progress, setProgress] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (mounted.current) onFinish();
          }, 300);
          return 100;
        }
        return prev + 4;
      });
    }, 80);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center" translate="no">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto shadow-lg animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SenseNova Chat</h1>
            <p className="text-xs text-muted-foreground mt-1.5">
              开源 · 三模型混合调度 · 本地隐私保护
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-75 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {progress < 30 && "正在初始化..."}
              {progress >= 30 && progress < 60 && "加载组件..."}
              {progress >= 60 && progress < 90 && "准备就绪..."}
              {progress >= 90 && "即将启动"}
            </span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/40 p-2 space-y-1">
            <Bot className="w-4 h-4 mx-auto text-indigo-500" />
            <p className="text-[10px] text-muted-foreground">DeepSeek</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2 space-y-1">
            <Sparkles className="w-4 h-4 mx-auto text-emerald-500" />
            <p className="text-[10px] text-muted-foreground">Flash-Lite</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2 space-y-1">
            <Smartphone className="w-4 h-4 mx-auto text-pink-500" />
            <p className="text-[10px] text-muted-foreground">U1 Fast</p>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground">
            本地运行 · 数据不上云 · API Key 仅存内存 · 关闭即销毁
          </p>
          <p className="text-[10px] text-muted-foreground">
            密码本地哈希存储 · 遗失无法找回
          </p>
        </div>
      </div>
    </div>
  );
}

/* ===================== API Key + Password Setup ===================== */

function SetupScreen({ onDone }: { onDone: (key: string) => void }) {
  const [step, setStep] = useState<"key" | "pwd">("key");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState("");

  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith("sk-")) {
      setKeyError("请输入以 sk- 开头的有效 SenseNova API Key");
      return;
    }
    setKeyError("");
    setStep("pwd");
  };

  const handleSaveAll = async () => {
    const trimmed = password.trim();
    if (trimmed.length < 4) {
      setPwdError("密码至少 4 位");
      return;
    }

    const salt = generateSalt();
    const hash = await doubleHash(trimmed, salt);

    // 仅保存密码哈希到 localStorage（用于锁屏验证）
    // API Key 仅保存在内存中，关闭网页即销毁
    localStorage.setItem(LS_SALT, salt);
    localStorage.setItem(LS_PWD_HASH, hash);

    onDone(apiKey.trim());
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background px-4" translate="no">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">SenseNova Chat</h1>
            <p className="text-xs text-muted-foreground mt-1">
              开源 · 三模型混合调度 · 单流输出
            </p>
          </div>
        </div>

        {step === "key" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                SenseNova API Key
              </label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyError("");
                  }}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  className="pr-10 h-11"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {keyError && <p className="text-xs text-destructive">{keyError}</p>}
            </div>

            <Button className="w-full h-10" onClick={handleSaveKey} disabled={!apiKey.trim()}>
              <KeyRound className="w-4 h-4 mr-2" />
              下一步：设置本地密码
            </Button>

            <a
              href="https://www.sensenova.cn/token-plan"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              还没有账号？点击注册
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 安全警告 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                重要安全提醒
              </p>
              <div className="space-y-1 text-[11px] text-amber-700 dark:text-amber-500/90">
                <p className="flex items-start gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  API Key 仅保存在内存中，关闭网页即销毁
                </p>
                <p className="flex items-start gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  本地密码用于锁屏保护，经二次哈希加密存储
                </p>
                <p className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  密码遗失无法找回，请妥善保管
                </p>
                <p className="flex items-start gap-1.5">
                  <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  不可切换设备使用同一密钥，换设备需重新配置
                </p>
                <p className="flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  密码仅存于本地，不上传云端
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                本地密码
              </label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPwdError("");
                  }}
                  placeholder="不少于4位字符，建议复杂组合"
                  className="pr-10 h-11"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveAll()}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
            </div>

            <Button className="w-full h-10" onClick={handleSaveAll} disabled={!password.trim()}>
              <Lock className="w-4 h-4 mr-2" />
              开启隐私保护并开始使用
            </Button>

            <button
              onClick={() => setStep("key")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              返回上一步
            </button>
          </div>
        )}

        <div className="text-center space-y-1">
          <p className="text-[11px] text-muted-foreground">
            API Key 仅保存在内存中，关闭网页即销毁 · 密码仅存于本地
          </p>
          <p className="text-[11px] text-muted-foreground">
            开源项目 · 额度由用户自行控制
          </p>
        </div>
      </div>
    </div>
  );
}

/* ===================== Main Chat App ===================== */

export default function App() {
  // API Key 仅保存在内存中，关闭网页即销毁
  const [apiKey, setApiKey] = useState<string | null>(null);

  const [showSplash, setShowSplash] = useState(true);
  const [locked, setLocked] = useState(false);
  const { messages, current, sendMessage, stop } = useMultiModelChat(apiKey);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, current.content, current.thinking]);

  /* Page visibility / blur lock */
  useEffect(() => {
    if (!apiKey) return;

    const handleLock = () => {
      if (document.visibilityState === "hidden") {
        setLocked(true);
      }
    };

    const handleBlur = () => {
      setLocked(true);
    };

    document.addEventListener("visibilitychange", handleLock);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleLock);
      window.removeEventListener("blur", handleBlur);
    };
  }, [apiKey]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || current.loading) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleLogout = useCallback(() => {
    if (!confirm("确定要退出吗？这会清除本地密码和所有聊天记录，保护个人隐私。API Key 将随页面关闭而销毁。")) {
      return;
    }
    localStorage.removeItem(LS_PWD_HASH);
    localStorage.removeItem(LS_SALT);
    setApiKey(null);
    window.location.reload();
  }, []);

  const handleManualLock = useCallback(() => {
    setLocked(true);
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!apiKey) {
    return <SetupScreen onDone={setApiKey} />;
  }

  const hasMessages = messages.length > 0 || current.loading;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground relative" translate="no">
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}

      {/* Header */}
      <header className="shrink-0 px-4 py-2.5 border-b flex items-center justify-between" translate="no">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            SN
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight">SenseNova</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
              开源
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {current.loading && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={stop}>
              <Square className="w-3 h-3 mr-1" />
              停止
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleManualLock}
            title="手动锁屏"
          >
            <Lock className="w-3 h-3 mr-1" />
            锁屏
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-3 h-3 mr-1" />
            退出
          </Button>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth" translate="no">
        <div className="max-w-3xl mx-auto space-y-6">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-1">SenseNova 混合智能助手</h2>
                <p className="text-sm text-muted-foreground">
                  DeepSeek + Flash-Lite + U1 三模型协作，为你提供一条精准答案
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-lg border px-3 py-2 bg-muted/40">
                  DeepSeek V4 深度推理
                </div>
                <div className="rounded-lg border px-3 py-2 bg-muted/40">
                  Flash-Lite 意图识别
                </div>
                <div className="rounded-lg border px-3 py-2 bg-muted/40">
                  U1 Fast 智能配图
                </div>
                <div className="rounded-lg border px-3 py-2 bg-muted/40">
                  单流式统一输出
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")} translate="no">
              {msg.role === "assistant" && (
                <div className="mt-1 shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="space-y-1">
                    <div className="text-sm leading-relaxed">{formatContent(msg.content)}</div>
                    {msg.imageUrl && (
                      <div className="mt-2 rounded-xl overflow-hidden border">
                        <ImageWithFallback src={msg.imageUrl} alt="AI generated" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="mt-1 shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Current streaming answer */}
          {current.loading && (
            <div className="flex gap-3 justify-start" translate="no">
              <div className="mt-1 shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                {current.thinking && !current.content && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>三模型正在协同分析...</span>
                  </div>
                )}
                {current.error && (
                  <div className="text-sm text-destructive">出错：{current.error}</div>
                )}
                {current.content && (
                  <div className="space-y-1">
                    <ReasoningBlock reasoning={current.reasoning} />
                    <div className="text-sm leading-relaxed">
                      {formatContent(current.content)}
                      <TypingCursor />
                    </div>
                  </div>
                )}
                {current.imageUrl && (
                  <div className="mt-2 rounded-xl overflow-hidden border">
                    <ImageWithFallback src={current.imageUrl} alt="AI generated" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input area */}
      <div className="shrink-0 border-t bg-card/60 backdrop-blur px-4 py-3" translate="no">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，三模型将协作给出一条答案..."
            rows={1}
            className="min-h-[44px] max-h-[200px] resize-none py-3 px-4 rounded-xl"
            disabled={current.loading}
          />
          <Button
            size="icon"
            className="shrink-0 h-11 w-11 rounded-xl"
            onClick={handleSubmit}
            disabled={!input.trim() || current.loading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-1.5">
          Shift + Enter 换行 · API Key 仅存内存 · 关闭即销毁 · 本地密码保护
        </p>
        <a
          href="https://github.com/yuanfengjie466-star/smxdy"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          查看开源仓库
        </a>
      </div>
    </div>
  );
}
