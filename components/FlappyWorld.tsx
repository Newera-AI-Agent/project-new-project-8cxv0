"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ----- Types -----
interface Bird {
  x: number;
  y: number;
  velocity: number;
  rotation: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

// ----- Constants -----
const GRAVITY = 0.5;
const JUMP_FORCE = -8;
const BIRD_X = 100;
const BIRD_SIZE = 28;
const PIPE_WIDTH = 60;
const PIPE_GAP = 140;
const PIPE_SPEED = 2.5;
const PIPE_SPACING = 220;
const GROUND_HEIGHT = 60;

export default function FlappyWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"menu" | "playing" | "dead">("menu");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const birdRef = useRef<Bird>({ x: BIRD_X, y: 0, velocity: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const frameRef = useRef(0);
  const gravityRef = useRef(GRAVITY);
  const animRef = useRef<number>(0);
  const groundScrollRef = useRef(0);

  const [dimensions, setDimensions] = useState({ width: 480, height: 700 });

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem("flappy-world-high");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Responsive canvas
  useEffect(() => {
    const resize = () => {
      const maxW = Math.min(window.innerWidth - 32, 480);
      const maxH = Math.min(window.innerHeight - 120, 700);
      setDimensions({ width: maxW, height: maxH });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const resetGame = useCallback(() => {
    birdRef.current = {
      x: BIRD_X,
      y: dimensions.height / 2,
      velocity: 0,
      rotation: 0,
    };
    pipesRef.current = [
      { x: dimensions.width, topHeight: randomPipeHeight(dimensions.height), passed: false },
      { x: dimensions.width + PIPE_SPACING, topHeight: randomPipeHeight(dimensions.height), passed: false },
    ];
    particlesRef.current = [];
    scoreRef.current = 0;
    frameRef.current = 0;
    gravityRef.current = GRAVITY;
    groundScrollRef.current = 0;
    setScore(0);
  }, [dimensions.height, dimensions.width]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState("playing");
  }, [resetGame]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Canvas 2D context not available");
      return;
    }

    if (gameState !== "playing" && gameState !== "dead") {
      // Draw menu or static frame
      drawFrame(ctx, canvas, dimensions);
      return;
    }

    let lastTime = 0;
    const loop = (time: number) => {
      if (lastTime === 0) lastTime = time;
      const dt = Math.min((time - lastTime) / 16.67, 3); // cap delta
      lastTime = time;

      update(dt, dimensions);
      drawFrame(ctx, canvas, dimensions);

      if (gameState === "playing") {
        animRef.current = requestAnimationFrame(loop);
      }
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, dimensions, isMuted]);

  // Draw menu frame when not playing
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "dead") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
      console.error("Canvas 2D context not available");
      return;
    }
      drawFrame(ctx, canvas, dimensions);
    }
  });

  const update = (dt: number, dims: { width: number; height: number }) => {
    const bird = birdRef.current;
    const pipes = pipesRef.current;
    const effectiveGravity = gravityRef.current * dt;

    // Bird physics
    bird.velocity += effectiveGravity;
    bird.y += bird.velocity * dt;

    // Rotation based on velocity
    bird.rotation = Math.min(Math.max(bird.velocity * 4, -30), 70);

    // Ground / ceiling limit
    const groundY = dims.height - GROUND_HEIGHT;
    if (bird.y + BIRD_SIZE / 2 >= groundY) {
      bird.y = groundY - BIRD_SIZE / 2;
      die();
    }
    if (bird.y - BIRD_SIZE / 2 <= 0) {
      bird.y = BIRD_SIZE / 2;
      bird.velocity = 1;
    }

    // Move pipes
    const scaledSpeed = PIPE_SPEED * dt;
    for (let i = pipes.length - 1; i >= 0; i--) {
      pipes[i].x -= scaledSpeed;

      // Remove off-screen pipes
      if (pipes[i].x + PIPE_WIDTH < -50) {
        pipes.splice(i, 1);
        continue;
      }

      // Score check
      if (!pipes[i].passed && pipes[i].x + PIPE_WIDTH < BIRD_X) {
        pipes[i].passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
        if (scoreRef.current > highScore) {
          setHighScore(scoreRef.current);
          localStorage.setItem("flappy-world-high", String(scoreRef.current));
        }
        // Spawn particles on score
        spawnScoreParticles(bird.x, bird.y);
      }

      // Collision
      if (checkCollision(bird, pipes[i], dims.height)) {
        die();
        return;
      }
    }

    // Spawn new pipes
    const lastPipe = pipes[pipes.length - 1];
    if (!lastPipe || lastPipe.x < dims.width - PIPE_SPACING) {
      pipes.push({
        x: dims.width + 20,
        topHeight: randomPipeHeight(dims.height),
        passed: false,
      });
    }

    // Update particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.1 * dt;
      p.life -= dt;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

    // Ground scroll
    groundScrollRef.current = (groundScrollRef.current + scaledSpeed) % 40;
    frameRef.current++;
  };

  const die = () => {
    if (gameState !== "playing") return;
    setGameState("dead");
    spawnDeathParticles(birdRef.current.x, birdRef.current.y);
    cancelAnimationFrame(animRef.current);
  };

  const spawnScoreParticles = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1) * 4,
        life: 30,
        maxLife: 30,
        color: "#fbbf24",
      });
    }
  };

  const spawnDeathParticles = (x: number, y: number) => {
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color: ["#ef4444", "#f97316", "#fbbf24", "#ffffff"][Math.floor(Math.random() * 4)],
      });
    }
  };

  const jump = useCallback(() => {
    if (gameState === "menu") {
      startGame();
      return;
    }
    if (gameState === "playing") {
      birdRef.current.velocity = JUMP_FORCE;
    }
  }, [gameState, startGame]);

  // Keyboard input
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        jump();
      }
      if (gameState === "dead" && (e.code === "Space" || e.code === "Enter")) {
        startGame();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [jump, gameState, startGame]);

  const drawBird = (ctx: CanvasRenderingContext2D, bird: Bird) => {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate((bird.rotation * Math.PI) / 180);

    // Body
    const gradient = ctx.createRadialGradient(-2, -2, 2, 0, 0, BIRD_SIZE / 2);
    gradient.addColorStop(0, "#fde047");
    gradient.addColorStop(0.6, "#eab308");
    gradient.addColorStop(1, "#ca8a04");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eye
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(8, -6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(9, -6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(10, -7, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(BIRD_SIZE / 2 - 2, -2);
    ctx.lineTo(BIRD_SIZE / 2 + 10, 3);
    ctx.lineTo(BIRD_SIZE / 2 - 2, 8);
    ctx.closePath();
    ctx.fill();

    // Wing
    ctx.fillStyle = "#ca8a04";
    ctx.beginPath();
    ctx.ellipse(-5, 4, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  };

  const drawPipe = (
    ctx: CanvasRenderingContext2D,
    x: number,
    topHeight: number,
    canvasHeight: number
  ) => {
    const groundY = canvasHeight - GROUND_HEIGHT;
    const bottomPipeTop = topHeight + PIPE_GAP;
    const bottomPipeHeight = groundY - bottomPipeTop;

    // Pipe cap dimensions
    const capWidth = PIPE_WIDTH + 10;
    const capHeight = 25;

    // Top pipe body
    ctx.fillStyle = createPipeGradient(ctx, x, 0, PIPE_WIDTH, topHeight);
    ctx.fillRect(x, 0, PIPE_WIDTH, topHeight - capHeight);

    // Top pipe cap
    ctx.fillStyle = createPipeGradient(ctx, x - 5, topHeight - capHeight, capWidth, capHeight);
    ctx.fillRect(x - 5, topHeight - capHeight, capWidth, capHeight);
    ctx.strokeStyle = "#1e3a1e";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 5, topHeight - capHeight, capWidth, capHeight);

    // Top pipe rim
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(x - 5, topHeight - capHeight, capWidth, 6);

    // Bottom pipe body
    ctx.fillStyle = createPipeGradient(ctx, x, bottomPipeTop, PIPE_WIDTH, bottomPipeHeight);
    ctx.fillRect(x, bottomPipeTop, PIPE_WIDTH, bottomPipeHeight);

    // Bottom pipe cap
    ctx.fillStyle = createPipeGradient(ctx, x - 5, bottomPipeTop, capWidth, capHeight);
    ctx.fillRect(x - 5, bottomPipeTop, capWidth, capHeight);
    ctx.strokeStyle = "#1e3a1e";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 5, bottomPipeTop, capWidth, capHeight);

    // Bottom pipe rim
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(x - 5, bottomPipeTop + capHeight - 6, capWidth, 6);

    // Vertical shadows
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x + 4, 0, 6, topHeight - capHeight);
    ctx.fillRect(x + 4, bottomPipeTop, 6, bottomPipeHeight);
  };

  const createPipeGradient = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "#22c55e");
    grad.addColorStop(0.3, "#16a34a");
    grad.addColorStop(0.7, "#15803d");
    grad.addColorStop(1, "#166534");
    return grad;
  };

  const checkCollision = (bird: Bird, pipe: Pipe, canvasHeight: number): boolean => {
    const groundY = canvasHeight - GROUND_HEIGHT;
    const half = BIRD_SIZE / 2;

    // Only check collision if bird is near the pipe horizontally
    if (bird.x + half < pipe.x || bird.x - half > pipe.x + PIPE_WIDTH) return false;

    // Top pipe
    if (bird.y - half < pipe.topHeight) return true;

    // Bottom pipe
    const bottomPipeTop = pipe.topHeight + PIPE_GAP;
    if (bird.y + half > bottomPipeTop && bottomPipeTop < groundY) return true;

    return false;
  };

  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    dims: { width: number; height: number }
  ) => {
    const { width, height } = dims;
    canvas.width = width;
    canvas.height = height;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, "#4cc9f0");
    skyGrad.addColorStop(0.7, "#87ceeb");
    skyGrad.addColorStop(1, "#a5d8ff");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Clouds
    drawCloud(ctx, 60, 80, 0.7);
    drawCloud(ctx, 280, 50, 0.5);
    drawCloud(ctx, 380, 120, 0.6);
    drawCloud(ctx, 140, 180, 0.4);

    if (gameState === "menu" || gameState === "dead") {
      // Draw pipes (in menu/dead, pipes don't move)
      const pipes = pipesRef.current;
      for (const pipe of pipes) {
        drawPipe(ctx, pipe.x, pipe.topHeight, height);
      }

      // Draw bird
      const bird = birdRef.current;
      if (bird.y === 0) bird.y = height / 2;
      // Bobbing animation for menu
      if (gameState === "menu") {
        bird.y = height / 2 + Math.sin(Date.now() / 300) * 10;
      }
      drawBird(ctx, bird);

      // Draw ground
      drawGround(ctx, width, height);

      // Particles
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (gameState === "playing" || gameState === "dead") {
      // Draw pipes
      for (const pipe of pipesRef.current) {
        drawPipe(ctx, pipe.x, pipe.topHeight, height);
      }

      // Draw bird
      drawBird(ctx, birdRef.current);

      // Draw particles
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw ground
      drawGround(ctx, width, height);

      // Score display
      if (gameState === "playing" || gameState === "dead") {
        drawScore(ctx, scoreRef.current, width);
      }
    }

    // Menu overlay
    if (gameState === "menu") {
      drawMenu(ctx, width, height);
    }

    // Death overlay
    if (gameState === "dead") {
      drawDeathScreen(ctx, width, height);
    }
  };

  const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(x, y, 25 * scale, 0, Math.PI * 2);
    ctx.arc(x + 22 * scale, y - 8 * scale, 20 * scale, 0, Math.PI * 2);
    ctx.arc(x + 44 * scale, y, 22 * scale, 0, Math.PI * 2);
    ctx.arc(x + 20 * scale, y + 6 * scale, 18 * scale, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawGround = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const groundY = height - GROUND_HEIGHT;

    // Grass
    const grassGrad = ctx.createLinearGradient(0, groundY, 0, height);
    grassGrad.addColorStop(0, "#4ade80");
    grassGrad.addColorStop(0.3, "#22c55e");
    grassGrad.addColorStop(1, "#15803d");
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, groundY, width, GROUND_HEIGHT);

    // Grass tufts
    ctx.fillStyle = "#86efac";
    const scroll = groundScrollRef.current;
    for (let i = -scroll; i < width + 40; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, groundY);
      ctx.lineTo(i + 6, groundY - 8);
      ctx.lineTo(i + 12, groundY);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(i + 10, groundY);
      ctx.lineTo(i + 16, groundY - 6);
      ctx.lineTo(i + 22, groundY);
      ctx.fill();
    }

    // Top edge highlight
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
  };

  const drawScore = (ctx: CanvasRenderingContext2D, s: number, width: number) => {
    ctx.save();
    ctx.font = "bold 48px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 3;
    const text = String(s);
    ctx.strokeText(text, width / 2, 64);
    ctx.fillText(text, width / 2, 64);
    ctx.restore();
  };

  const drawMenu = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.save();
    ctx.font = "bold 42px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1e3a1e";
    ctx.lineWidth = 4;
    ctx.strokeText("FLAPPY WORLD", width / 2, height * 0.25);
    ctx.fillText("FLAPPY WORLD", width / 2, height * 0.25);

    // Subtitle
    ctx.font = "16px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.lineWidth = 0;
    ctx.fillText("Tap or press SPACE to fly", width / 2, height * 0.25 + 40);

    // Instructions
    ctx.font = "bold 18px Inter, system-ui, sans-serif";
    const btnY = height * 0.55;

    // Start button
    const btnW = 180;
    const btnH = 50;
    const btnX = width / 2 - btnW / 2;

    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 3;
    roundRect(ctx, btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#78350f";
    ctx.lineWidth = 0;
    ctx.font = "bold 20px Inter, system-ui, sans-serif";
    ctx.fillText("▶  START", width / 2, btnY + 33);

    // High score
    ctx.font = "14px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`Best: ${highScore}`, width / 2, btnY + 80);
    ctx.restore();
  };

  const drawDeathScreen = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.textAlign = "center";

    // Game over
    ctx.font = "bold 36px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3;
    ctx.strokeText("GAME OVER", width / 2, height * 0.35);
    ctx.fillText("GAME OVER", width / 2, height * 0.35);

    // Score
    ctx.font = "bold 24px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 0;
    ctx.fillText(`Score: ${scoreRef.current}`, width / 2, height * 0.35 + 50);

    ctx.font = "16px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Best: ${highScore}`, width / 2, height * 0.35 + 80);

    // Restart hint
    ctx.font = "bold 18px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Press SPACE to retry", width / 2, height * 0.6);
    ctx.restore();
  };

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const randomPipeHeight = (canvasHeight: number): number => {
    const minHeight = 60;
    const maxHeight = canvasHeight - GROUND_HEIGHT - PIPE_GAP - 60;
    return Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-xl shadow-2xl cursor-pointer"
        onClick={() => {
          if (gameState === "menu") startGame();
          else if (gameState === "playing") jump();
          else if (gameState === "dead") startGame();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          if (gameState === "menu") startGame();
          else if (gameState === "playing") jump();
          else if (gameState === "dead") startGame();
        }}
      />
      {/* Mute toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsMuted(!isMuted);
        }}
        className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm 
                   flex items-center justify-center text-white hover:bg-white/30 transition-colors
                   text-lg"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
