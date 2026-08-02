# read_file — components/FlappyWorld.tsx

_captured 2026-08-02T14:02:36.277Z_

components/FlappyWorld.tsx [1-711 of 711]
1: "use client";
2: 
3: import { useRef, useEffect, useState, useCallback } from "react";
4: 
5: // ----- Types -----
6: interface Bird {
7:   x: number;
8:   y: number;
9:   velocity: number;
10:   rotation: number;
11: }
12: 
13: interface Pipe {
14:   x: number;
15:   topHeight: number;
16:   passed: boolean;
17: }
18: 
19: interface Particle {
20:   x: number;
21:   y: number;
22:   vx: number;
23:   vy: number;
24:   life: number;
25:   maxLife: number;
26:   color: string;
27: }
28: 
29: // ----- Constants -----
30: const GRAVITY = 0.5;
31: const JUMP_FORCE = -8;
32: const BIRD_X = 100;
33: const BIRD_SIZE = 28;
34: const PIPE_WIDTH = 60;
35: const PIPE_GAP = 140;
36: const PIPE_SPEED = 2.5;
37: const PIPE_SPACING = 220;
38: const GROUND_HEIGHT = 60;
39: 
40: export default function FlappyWorld() {
41:   const canvasRef = useRef<HTMLCanvasElement>(null);
42:   const [gameState, setGameState] = useState<"menu" | "playing" | "dead">("menu");
43:   const [score, setScore] = useState(0);
44:   const [highScore, setHighScore] = useState(0);
45:   const [isMuted, setIsMuted] = useState(false);
46: 
47:   const birdRef = useRef<Bird>({ x: BIRD_X, y: 0, velocity: 0, rotation: 0 });
48:   const pipesRef = useRef<Pipe[]>([]);
49:   const particlesRef = useRef<Particle[]>([]);
50:   const scoreRef = useRef(0);
51:   const frameRef = useRef(0);
52:   const gravityRef = useRef(GRAVITY);
53:   const animRef = useRef<number>(0);
54:   const groundScrollRef = useRef(0);
55: 
56:   const [dimensions, setDimensions] = useState({ width: 480, height: 700 });
57: 
58:   // Load high score
59:   useEffect(() => {
60:     const saved = localStorage.getItem("flappy-world-high");
61:     if (saved) setHighScore(parseInt(saved, 10));
62:   }, []);
63: 
64:   // Responsive canvas
65:   useEffect(() => {
66:     const resize = () => {
67:       const maxW = Math.min(window.innerWidth - 32, 480);
68:       const maxH = Math.min(window.innerHeight - 120, 700);
69:       setDimensions({ width: maxW, height: maxH });
70:     };
71:     resize();
72:     window.addEventListener("resize", resize);
73:     return () => window.removeEventListener("resize", resize);
74:   }, []);
75: 
76:   const resetGame = useCallback(() => {
77:     birdRef.current = {
78:       x: BIRD_X,
79:       y: dimensions.height / 2,
80:       velocity: 0,
81:       rotation: 0,
82:     };
83:     pipesRef.current = [
84:       { x: dimensions.width, topHeight: randomPipeHeight(dimensions.height), passed: false },
85:       { x: dimensions.width + PIPE_SPACING, topHeight: randomPipeHeight(dimensions.height), passed: false },
86:     ];
87:     particlesRef.current = [];
88:     scoreRef.current = 0;
89:     frameRef.current = 0;
90:     gravityRef.current = GRAVITY;
91:     groundScrollRef.current = 0;
92:     setScore(0);
93:   }, [dimensions.height, dimensions.width]);
94: 
95:   const startGame = useCallback(() => {
96:     resetGame();
97:     setGameState("playing");
98:   }, [resetGame]);
99: 
100:   // Game loop
101:   useEffect(() => {
102:     const canvas = canvasRef.current;
103:     if (!canvas) return;
104:     const ctx = canvas.getContext("2d");
105:     if (!ctx) return;
106: 
107:     if (gameState !== "playing" && gameState !== "dead") {
108:       // Draw menu or static frame
109:       drawFrame(ctx, canvas, dimensions);
110:       return;
111:     }
112: 
113:     let lastTime = 0;
114:     const loop = (time: number) => {
115:       if (lastTime === 0) lastTime = time;
116:       const dt = Math.min((time - lastTime) / 16.67, 3); // cap delta
117:       lastTime = time;
118: 
119:       update(dt, dimensions);
120:       drawFrame(ctx, canvas, dimensions);
121: 
122:       if (gameState === "playing") {
123:         animRef.current = requestAnimationFrame(loop);
124:       }
125:     };
126: 
127:     animRef.current = requestAnimationFrame(loop);
128:     return () => cancelAnimationFrame(animRef.current);
129:   }, [gameState, dimensions, isMuted]);
130: 
131:   // Draw menu frame when not playing
132:   useEffect(() => {
133:     if (gameState !== "playing" && gameState !== "dead") {
134:       const canvas = canvasRef.current;
135:       if (!canvas) return;
136:       const ctx = canvas.getContext("2d");
137:       if (!ctx) return;
138:       drawFrame(ctx, canvas, dimensions);
139:     }
140:   });
141: 
142:   const update = (dt: number, dims: { width: number; height: number }) => {
143:     const bird = birdRef.current;
144:     const pipes = pipesRef.current;
145:     const effectiveGravity = gravityRef.current * dt;
146: 
147:     // Bird physics
148:     bird.velocity += effectiveGravity;
149:     bird.y += bird.velocity * dt;
150: 
151:     // Rotation based on velocity
152:     bird.rotation = Math.min(Math.max(bird.velocity * 4, -30), 70);
153: 
154:     // Ground / ceiling limit
155:     const groundY = dims.height - GROUND_HEIGHT;
156:     if (bird.y + BIRD_SIZE / 2 >= groundY) {
157:       bird.y = groundY - BIRD_SIZE / 2;
158:       die();
159:     }
160:     if (bird.y - BIRD_SIZE / 2 <= 0) {
161:       bird.y = BIRD_SIZE / 2;
162:       bird.velocity = 1;
163:     }
164: 
165:     // Move pipes
166:     const scaledSpeed = PIPE_SPEED * dt;
167:     for (let i = pipes.length - 1; i >= 0; i--) {
168:       pipes[i].x -= scaledSpeed;
169: 
170:       // Remove off-screen pipes
171:       if (pipes[i].x + PIPE_WIDTH < -50) {
172:         pipes.splice(i, 1);
173:         continue;
174:       }
175: 
176:       // Score check
177:       if (!pipes[i].passed && pipes[i].x + PIPE_WIDTH < BIRD_X) {
178:         pipes[i].passed = true;
179:         scoreRef.current += 1;
180:         setScore(scoreRef.current);
181:         if (scoreRef.current > highScore) {
182:           setHighScore(scoreRef.current);
183:           localStorage.setItem("flappy-world-high", String(scoreRef.current));
184:         }
185:         // Spawn particles on score
186:         spawnScoreParticles(bird.x, bird.y);
187:       }
188: 
189:       // Collision
190:       if (checkCollision(bird, pipes[i], dims.height)) {
191:         die();
192:         return;
193:       }
194:     }
195: 
196:     // Spawn new pipes
197:     const lastPipe = pipes[pipes.length - 1];
198:     if (!lastPipe || lastPipe.x < dims.width - PIPE_SPACING) {
199:       pipes.push({
200:         x: dims.width + 20,
201:         topHeight: randomPipeHeight(dims.height),
202:         passed: false,
203:       });
204:     }
205: 
206:     // Update particles
207:     for (let i = particlesRef.current.length - 1; i >= 0; i--) {
208:       const p = particlesRef.current[i];
209:       p.x += p.vx * dt;
210:       p.y += p.vy * dt;
211:       p.vy += 0.1 * dt;
212:       p.life -= dt;
213:       if (p.life <= 0) particlesRef.current.splice(i, 1);
214:     }
215: 
216:     // Ground scroll
217:     groundScrollRef.current = (groundScrollRef.current + scaledSpeed) % 40;
218:     frameRef.current++;
219:   };
220: 
221:   const die = () => {
222:     if (gameState !== "playing") return;
223:     setGameState("dead");
224:     spawnDeathParticles(birdRef.current.x, birdRef.current.y);
225:     cancelAnimationFrame(animRef.current);
226:   };
227: 
228:   const spawnScoreParticles = (x: number, y: number) => {
229:     for (let i = 0; i < 8; i++) {
230:       particlesRef.current.push({
231:         x,
232:         y,
233:         vx: (Math.random() - 0.5) * 4,
234:         vy: (Math.random() - 1) * 4,
235:         life: 30,
236:         maxLife: 30,
237:         color: "#fbbf24",
238:       });
239:     }
240:   };
241: 
242:   const spawnDeathParticles = (x: number, y: number) => {
243:     for (let i = 0; i < 20; i++) {
244:       particlesRef.current.push({
245:         x,
246:         y,
247:         vx: (Math.random() - 0.5) * 8,
248:         vy: (Math.random() - 0.5) * 8 - 2,
249:         life: 40 + Math.random() * 20,
250:         maxLife: 60,
251:         color: ["#ef4444", "#f97316", "#fbbf24", "#ffffff"][Math.floor(Math.random() * 4)],
252:       });
253:     }
254:   };
255: 
256:   const jump = useCallback(() => {
257:     if (gameState === "menu") {
258:       startGame();
259:       return;
260:     }
261:     if (gameState === "playing") {
262:       birdRef.current.velocity = JUMP_FORCE;
263:     }
264:   }, [gameState, startGame]);
265: 
266:   // Keyboard input
267:   useEffect(() => {
268:     const handleKey = (e: KeyboardEvent) => {
269:       if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
270:         e.preventDefault();
271:         jump();
272:       }
273:       if (gameState === "dead" && (e.code === "Space" || e.code === "Enter")) {
274:         startGame();
275:       }
276:     };
277:     window.addEventListener("keydown", handleKey);
278:     return () => window.removeEventListener("keydown", handleKey);
279:   }, [jump, gameState, startGame]);
280: 
281:   const drawBird = (ctx: CanvasRenderingContext2D, bird: Bird) => {
282:     ctx.save();
283:     ctx.translate(bird.x, bird.y);
284:     ctx.rotate((bird.rotation * Math.PI) / 180);
285: 
286:     // Body
287:     const gradient = ctx.createRadialGradient(-2, -2, 2, 0, 0, BIRD_SIZE / 2);
288:     gradient.addColorStop(0, "#fde047");
289:     gradient.addColorStop(0.6, "#eab308");
290:     gradient.addColorStop(1, "#ca8a04");
291: 
292:     ctx.fillStyle = gradient;
293:     ctx.beginPath();
294:     ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
295:     ctx.fill();
296:     ctx.strokeStyle = "#854d0e";
297:     ctx.lineWidth = 2;
298:     ctx.stroke();
299: 
300:     // Eye
301:     ctx.fillStyle = "white";
302:     ctx.beginPath();
303:     ctx.arc(8, -6, 6, 0, Math.PI * 2);
304:     ctx.fill();
305:     ctx.fillStyle = "#1e293b";
306:     ctx.beginPath();
307:     ctx.arc(9, -6, 3, 0, Math.PI * 2);
308:     ctx.fill();
309:     ctx.fillStyle = "white";
310:     ctx.beginPath();
311:     ctx.arc(10, -7, 1.2, 0, Math.PI * 2);
312:     ctx.fill();
313: 
314:     // Beak
315:     ctx.fillStyle = "#f97316";
316:     ctx.beginPath();
317:     ctx.moveTo(BIRD_SIZE / 2 - 2, -2);
318:     ctx.lineTo(BIRD_SIZE / 2 + 10, 3);
319:     ctx.lineTo(BIRD_SIZE / 2 - 2, 8);
320:     ctx.closePath();
321:     ctx.fill();
322: 
323:     // Wing
324:     ctx.fillStyle = "#ca8a04";
325:     ctx.beginPath();
326:     ctx.ellipse(-5, 4, 8, 5, -0.3, 0, Math.PI * 2);
327:     ctx.fill();
328:     ctx.strokeStyle = "#854d0e";
329:     ctx.lineWidth = 1.5;
330:     ctx.stroke();
331: 
332:     ctx.restore();
333:   };
334: 
335:   const drawPipe = (
336:     ctx: CanvasRenderingContext2D,
337:     x: number,
338:     topHeight: number,
339:     canvasHeight: number
340:   ) => {
341:     const groundY = canvasHeight - GROUND_HEIGHT;
342:     const bottomPipeTop = topHeight + PIPE_GAP;
343:     const bottomPipeHeight = groundY - bottomPipeTop;
344: 
345:     // Pipe cap dimensions
346:     const capWidth = PIPE_WIDTH + 10;
347:     const capHeight = 25;
348: 
349:     // Top pipe body
350:     ctx.fillStyle = createPipeGradient(ctx, x, 0, PIPE_WIDTH, topHeight);
351:     ctx.fillRect(x, 0, PIPE_WIDTH, topHeight - capHeight);
352: 
353:     // Top pipe cap
354:     ctx.fillStyle = createPipeGradient(ctx, x - 5, topHeight - capHeight, capWidth, capHeight);
355:     ctx.fillRect(x - 5, topHeight - capHeight, capWidth, capHeight);
356:     ctx.strokeStyle = "#1e3a1e";
357:     ctx.lineWidth = 2;
358:     ctx.strokeRect(x - 5, topHeight - capHeight, capWidth, capHeight);
359: 
360:     // Top pipe rim
361:     ctx.fillStyle = "#22c55e";
362:     ctx.fillRect(x - 5, topHeight - capHeight, capWidth, 6);
363: 
364:     // Bottom pipe body
365:     ctx.fillStyle = createPipeGradient(ctx, x, bottomPipeTop, PIPE_WIDTH, bottomPipeHeight);
366:     ctx.fillRect(x, bottomPipeTop, PIPE_WIDTH, bottomPipeHeight);
367: 
368:     // Bottom pipe cap
369:     ctx.fillStyle = createPipeGradient(ctx, x - 5, bottomPipeTop, capWidth, capHeight);
370:     ctx.fillRect(x - 5, bottomPipeTop, capWidth, capHeight);
371:     ctx.strokeStyle = "#1e3a1e";
372:     ctx.lineWidth = 2;
373:     ctx.strokeRect(x - 5, bottomPipeTop, capWidth, capHeight);
374: 
375:     // Bottom pipe rim
376:     ctx.fillStyle = "#22c55e";
377:     ctx.fillRect(x - 5, bottomPipeTop + capHeight - 6, capWidth, 6);
378: 
379:     // Vertical shadows
380:     ctx.fillStyle = "rgba(0,0,0,0.15)";
381:     ctx.fillRect(x + 4, 0, 6, topHeight - capHeight);
382:     ctx.fillRect(x + 4, bottomPipeTop, 6, bottomPipeHeight);
383:   };
384: 
385:   const createPipeGradient = (
386:     ctx: CanvasRenderingContext2D,
387:     x: number,
388:     y: number,
389:     w: number,
390:     h: number
391:   ) => {
392:     const grad = ctx.createLinearGradient(x, 0, x + w, 0);
393:     grad.addColorStop(0, "#22c55e");
394:     grad.addColorStop(0.3, "#16a34a");
395:     grad.addColorStop(0.7, "#15803d");
396:     grad.addColorStop(1, "#166534");
397:     return grad;
398:   };
399: 
400:   const checkCollision = (bird: Bird, pipe: Pipe, canvasHeight: number): boolean => {
401:     const groundY = canvasHeight - GROUND_HEIGHT;
402:     const half = BIRD_SIZE / 2;
403: 
404:     // Only check collision if bird is near the pipe horizontally
405:     if (bird.x + half < pipe.x || bird.x - half > pipe.x + PIPE_WIDTH) return false;
406: 
407:     // Top pipe
408:     if (bird.y - half < pipe.topHeight) return true;
409: 
410:     // Bottom pipe
411:     const bottomPipeTop = pipe.topHeight + PIPE_GAP;
412:     if (bird.y + half > bottomPipeTop && bottomPipeTop < groundY) return true;
413: 
414:     return false;
415:   };
416: 
417:   const drawFrame = (
418:     ctx: CanvasRenderingContext2D,
419:     canvas: HTMLCanvasElement,
420:     dims: { width: number; height: number }
421:   ) => {
422:     const { width, height } = dims;
423:     canvas.width = width;
424:     canvas.height = height;
425: 
426:     // Sky gradient
427:     const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
428:     skyGrad.addColorStop(0, "#4cc9f0");
429:     skyGrad.addColorStop(0.7, "#87ceeb");
430:     skyGrad.addColorStop(1, "#a5d8ff");
431:     ctx.fillStyle = skyGrad;
432:     ctx.fillRect(0, 0, width, height);
433: 
434:     // Clouds
435:     drawCloud(ctx, 60, 80, 0.7);
436:     drawCloud(ctx, 280, 50, 0.5);
437:     drawCloud(ctx, 380, 120, 0.6);
438:     drawCloud(ctx, 140, 180, 0.4);
439: 
440:     if (gameState === "menu" || gameState === "dead") {
441:       // Draw pipes (in menu/dead, pipes don't move)
442:       const pipes = pipesRef.current;
443:       for (const pipe of pipes) {
444:         drawPipe(ctx, pipe.x, pipe.topHeight, height);
445:       }
446: 
447:       // Draw bird
448:       const bird = birdRef.current;
449:       if (bird.y === 0) bird.y = height / 2;
450:       // Bobbing animation for menu
451:       if (gameState === "menu") {
452:         bird.y = height / 2 + Math.sin(Date.now() / 300) * 10;
453:       }
454:       drawBird(ctx, bird);
455: 
456:       // Draw ground
457:       drawGround(ctx, width, height);
458: 
459:       // Particles
460:       for (const p of particlesRef.current) {
461:         ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
462:         ctx.fillStyle = p.color;
463:         ctx.beginPath();
464:         ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
465:         ctx.fill();
466:       }
467:       ctx.globalAlpha = 1;
468:     }
469: 
470:     if (gameState === "playing" || gameState === "dead") {
471:       // Draw pipes
472:       for (const pipe of pipesRef.current) {
473:         drawPipe(ctx, pipe.x, pipe.topHeight, height);
474:       }
475: 
476:       // Draw bird
477:       drawBird(ctx, birdRef.current);
478: 
479:       // Draw particles
480:       for (const p of particlesRef.current) {
481:         ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
482:         ctx.fillStyle = p.color;
483:         ctx.beginPath();
484:         ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
485:         ctx.fill();
486:       }
487:       ctx.globalAlpha = 1;
488: 
489:       // Draw ground
490:       drawGround(ctx, width, height);
491: 
492:       // Score display
493:       if (gameState === "playing" || gameState === "dead") {
494:         drawScore(ctx, scoreRef.current, width);
495:       }
496:     }
497: 
498:     // Menu overlay
499:     if (gameState === "menu") {
500:       drawMenu(ctx, width, height);
501:     }
502: 
503:     // Death overlay
504:     if (gameState === "dead") {
505:       drawDeathScreen(ctx, width, height);
506:     }
507:   };
508: 
509:   const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
510:     ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
511:     ctx.beginPath();
512:     ctx.arc(x, y, 25 * scale, 0, Math.PI * 2);
513:     ctx.arc(x + 22 * scale, y - 8 * scale, 20 * scale, 0, Math.PI * 2);
514:     ctx.arc(x + 44 * scale, y, 22 * scale, 0, Math.PI * 2);
515:     ctx.arc(x + 20 * scale, y + 6 * scale, 18 * scale, 0, Math.PI * 2);
516:     ctx.fill();
517:   };
518: 
519:   const drawGround = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
520:     const groundY = height - GROUND_HEIGHT;
521: 
522:     // Grass
523:     const grassGrad = ctx.createLinearGradient(0, groundY, 0, height);
524:     grassGrad.addColorStop(0, "#4ade80");
525:     grassGrad.addColorStop(0.3, "#22c55e");
526:     grassGrad.addColorStop(1, "#15803d");
527:     ctx.fillStyle = grassGrad;
528:     ctx.fillRect(0, groundY, width, GROUND_HEIGHT);
529: 
530:     // Grass tufts
531:     ctx.fillStyle = "#86efac";
532:     const scroll = groundScrollRef.current;
533:     for (let i = -scroll; i < width + 40; i += 40) {
534:       ctx.beginPath();
535:       ctx.moveTo(i, groundY);
536:       ctx.lineTo(i + 6, groundY - 8);
537:       ctx.lineTo(i + 12, groundY);
538:       ctx.fill();
539:       ctx.beginPath();
540:       ctx.moveTo(i + 10, groundY);
541:       ctx.lineTo(i + 16, groundY - 6);
542:       ctx.lineTo(i + 22, groundY);
543:       ctx.fill();
544:     }
545: 
546:     // Top edge highlight
547:     ctx.strokeStyle = "#86efac";
548:     ctx.lineWidth = 2;
549:     ctx.beginPath();
550:     ctx.moveTo(0, groundY);
551:     ctx.lineTo(width, groundY);
552:     ctx.stroke();
553:   };
554: 
555:   const drawScore = (ctx: CanvasRenderingContext2D, s: number, width: number) => {
556:     ctx.save();
557:     ctx.font = "bold 48px Inter, system-ui, sans-serif";
558:     ctx.fillStyle = "rgba(255,255,255,0.9)";
559:     ctx.textAlign = "center";
560:     ctx.strokeStyle = "rgba(0,0,0,0.3)";
561:     ctx.lineWidth = 3;
562:     const text = String(s);
563:     ctx.strokeText(text, width / 2, 64);
564:     ctx.fillText(text, width / 2, 64);
565:     ctx.restore();
566:   };
567: 
568:   const drawMenu = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
569:     // Semi-transparent overlay
570:     ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
571:     ctx.fillRect(0, 0, width, height);
572: 
573:     // Title
574:     ctx.save();
575:     ctx.font = "bold 42px Inter, system-ui, sans-serif";
576:     ctx.textAlign = "center";
577:     ctx.fillStyle = "#ffffff";
578:     ctx.strokeStyle = "#1e3a1e";
579:     ctx.lineWidth = 4;
580:     ctx.strokeText("FLAPPY WORLD", width / 2, height * 0.25);
581:     ctx.fillText("FLAPPY WORLD", width / 2, height * 0.25);
582: 
583:     // Subtitle
584:     ctx.font = "16px Inter, system-ui, sans-serif";
585:     ctx.fillStyle = "#e2e8f0";
586:     ctx.lineWidth = 0;
587:     ctx.fillText("Tap or press SPACE to fly", width / 2, height * 0.25 + 40);
588: 
589:     // Instructions
590:     ctx.font = "bold 18px Inter, system-ui, sans-serif";
591:     const btnY = height * 0.55;
592: 
593:     // Start button
594:     const btnW = 180;
595:     const btnH = 50;
596:     const btnX = width / 2 - btnW / 2;
597: 
598:     ctx.fillStyle = "#fbbf24";
599:     ctx.strokeStyle = "#92400e";
600:     ctx.lineWidth = 3;
601:     roundRect(ctx, btnX, btnY, btnW, btnH, 12);
602:     ctx.fill();
603:     ctx.stroke();
604: 
605:     ctx.fillStyle = "#78350f";
606:     ctx.lineWidth = 0;
607:     ctx.font = "bold 20px Inter, system-ui, sans-serif";
608:     ctx.fillText("▶  START", width / 2, btnY + 33);
609: 
610:     // High score
611:     ctx.font = "14px Inter, system-ui, sans-serif";
612:     ctx.fillStyle = "#e2e8f0";
613:     ctx.fillText(`Best: ${highScore}`, width / 2, btnY + 80);
614:     ctx.restore();
615:   };
616: 
617:   const drawDeathScreen = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
618:     ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
619:     ctx.fillRect(0, 0, width, height);
620: 
621:     ctx.save();
622:     ctx.textAlign = "center";
623: 
624:     // Game over
625:     ctx.font = "bold 36px Inter, system-ui, sans-serif";
626:     ctx.fillStyle = "#ef4444";
627:     ctx.strokeStyle = "rgba(0,0,0,0.5)";
628:     ctx.lineWidth = 3;
629:     ctx.strokeText("GAME OVER", width / 2, height * 0.35);
630:     ctx.fillText("GAME OVER", width / 2, height * 0.35);
631: 
632:     // Score
633:     ctx.font = "bold 24px Inter, system-ui, sans-serif";
634:     ctx.fillStyle = "#ffffff";
635:     ctx.lineWidth = 0;
636:     ctx.fillText(`Score: ${scoreRef.current}`, width / 2, height * 0.35 + 50);
637: 
638:     ctx.font = "16px Inter, system-ui, sans-serif";
639:     ctx.fillStyle = "#fbbf24";
640:     ctx.fillText(`Best: ${highScore}`, width / 2, height * 0.35 + 80);
641: 
642:     // Restart hint
643:     ctx.font = "bold 18px Inter, system-ui, sans-serif";
644:     ctx.fillStyle = "#e2e8f0";
645:     ctx.fillText("Press SPACE to retry", width / 2, height * 0.6);
646:     ctx.restore();
647:   };
648: 
649:   const roundRect = (
650:     ctx: CanvasRenderingContext2D,
651:     x: number,
652:     y: number,
653:     w: number,
654:     h: number,
655:     r: number
656:   ) => {
657:     ctx.beginPath();
658:     ctx.moveTo(x + r, y);
659:     ctx.lineTo(x + w - r, y);
660:     ctx.quadraticCurveTo(x + w, y, x + w, y + r);
661:     ctx.lineTo(x + w, y + h - r);
662:     ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
663:     ctx.lineTo(x + r, y + h);
664:     ctx.quadraticCurveTo(x, y + h, x, y + h - r);
665:     ctx.lineTo(x, y + r);
666:     ctx.quadraticCurveTo(x, y, x + r, y);
667:     ctx.closePath();
668:   };
669: 
670:   const randomPipeHeight = (canvasHeight: number): number => {
671:     const minHeight = 60;
672:     const maxHeight = canvasHeight - GROUND_HEIGHT - PIPE_GAP - 60;
673:     return Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
674:   };
675: 
676:   return (
677:     <div className="relative inline-block">
678:       <canvas
679:         ref={canvasRef}
680:         width={dimensions.width}
681:         height={dimensions.height}
682:         className="rounded-xl shadow-2xl cursor-pointer"
683:         onClick={() => {
684:           if (gameState === "menu") startGame();
685:           else if (gameState === "playing") jump();
686:           else if (gameState === "dead") startGame();
687:         }}
688:         onTouchStart={(e) => {
689:           e.preventDefault();
690:           if (gameState === "menu") startGame();
691:           else if (gameState === "playing") jump();
692:           else if (gameState === "dead") startGame();
693:         }}
694:       />
695:       {/* Mute toggle */}
696:       <button
697:         onClick={(e) => {
698:           e.stopPropagation();
699:           setIsMuted(!isMuted);
700:         }}
701:         className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm 
702:                    flex items-center justify-center text-white hover:bg-white/30 transition-colors
703:                    text-lg"
704:         title={isMuted ? "Unmute" : "Mute"}
705:       >
706:         {isMuted ? "🔇" : "🔊"}
707:       </button>
708:     </div>
709:   );
710: }
711: 
[END OF FILE — components/FlappyWorld.tsx is 711 lines; you have seen all of it.]
