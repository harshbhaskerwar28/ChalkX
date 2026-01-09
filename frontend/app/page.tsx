"use client"

import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Eraser, Pencil, Download, Send, Palette, Trash2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BlackboardAI() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState("#FFFFFF")
  const [pencilSize, setPencilSize] = useState(5)
  const [eraserSize, setEraserSize] = useState(20)
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil")
  const [result, setResult] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const initCanvas = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (ctx && canvas) {
        ctx.fillStyle = "#1a1a1a"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }

    initCanvas()
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [])

  const resizeCanvas = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (canvas && container) {
      const tempCanvas = document.createElement("canvas")
      const tempCtx = tempCanvas.getContext("2d")
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      tempCtx?.drawImage(canvas, 0, 0)

      const maxWidth = Math.min(800, container.offsetWidth * 0.95)
      const newWidth = maxWidth
      const newHeight = (maxWidth * 3) / 4

      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "#1a1a1a"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight)
      }
    }
  }

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    }
    return null
  }

  const startDrawing = (clientX: number, clientY: number) => {
    setIsDrawing(true)
    const point = getCanvasPoint(clientX, clientY)
    if (point) {
      setLastPoint(point)
      drawPoint(point)
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    setLastPoint(null)
  }

  const drawPoint = (point: { x: number; y: number }) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (ctx && canvas) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, (tool === "eraser" ? eraserSize : pencilSize) / 2, 0, Math.PI * 2)
      ctx.fillStyle = tool === "eraser" ? "#1a1a1a" : color
      ctx.fill()
    }
  }

  const drawLine = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (ctx && canvas) {
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.lineWidth = tool === "eraser" ? eraserSize : pencilSize
      ctx.lineCap = "round"
      ctx.strokeStyle = tool === "eraser" ? "#1a1a1a" : color
      ctx.stroke()
    }
  }

  const draw = (clientX: number, clientY: number) => {
    if (!isDrawing) return
    const point = getCanvasPoint(clientX, clientY)
    if (point && lastPoint) {
      drawLine(lastPoint, point)
      setLastPoint(point)
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (ctx && canvas) {
      ctx.fillStyle = "#1a1a1a"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    setResult(null)
    setError(null)
  }

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const image = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = image
      link.download = "blackboard.png"
      link.click()
    }
  }

  const analyzeImage = async () => {
    setError(null)
    setResult(null)
    const canvas = canvasRef.current
    if (!canvas) {
      setError("Canvas not found")
      return
    }

    try {
      setIsAnalyzing(true)

      // Get the image data
      const imageData = canvas.toDataURL("image/png").split(",")[1]

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (!data.result) {
        throw new Error("No analysis result received")
      }

      setResult(data.result)
    } catch (error) {
      console.error("Analysis error:", error)
      setError(error instanceof Error ? error.message : "Failed to analyze image")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center" ref={containerRef}>
      <div className="w-full max-w-3xl flex flex-col items-center gap-4">
        <h1 className="text-2xl sm:text-4xl font-bold">ChalkX</h1>

        {/* Toolbar */}
        <div className="w-full bg-gray-800 p-3 rounded-lg">
          <div className="flex flex-wrap gap-2 justify-center mb-2">
            <Button
              variant={tool === "pencil" ? "default" : "outline"}
              onClick={() => setTool("pencil")}
              className="flex-1 min-w-[100px] max-w-[150px]"
              size="sm"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Pencil
            </Button>

            <Button
              variant={tool === "eraser" ? "default" : "outline"}
              onClick={() => setTool("eraser")}
              className="flex-1 min-w-[100px] max-w-[150px]"
              size="sm"
            >
              <Eraser className="h-4 w-4 mr-1" />
              Eraser
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  style={{ backgroundColor: color, color: "#000000" }}
                  className="flex-1 min-w-[100px] max-w-[150px]"
                  size="sm"
                >
                  <Palette className="h-4 w-4 mr-1" />
                  Color
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="grid grid-cols-6 gap-2">
                  {[
                    "#FFFFFF",
                    "#FF0000",
                    "#00FF00",
                    "#0000FF",
                    "#FFFF00",
                    "#FF00FF",
                    "#00FFFF",
                    "#FFA500",
                    "#800080",
                    "#FFC0CB",
                    "#A52A2A",
                    "#008000",
                  ].map((c) => (
                    <button
                      key={c}
                      className="w-8 h-8 rounded-full border border-gray-600"
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={clearCanvas} className="flex-1 min-w-[100px] max-w-[150px]" size="sm">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>

            <Button variant="outline" onClick={downloadImage} className="flex-1 min-w-[100px] max-w-[150px]" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>

          <div className="flex items-center gap-2 px-2">
            <span className="text-sm whitespace-nowrap min-w-[80px]">
              {tool === "pencil" ? "Pencil" : "Eraser"} Size:
            </span>
            <Slider
              min={1}
              max={tool === "eraser" ? 50 : 20}
              step={1}
              value={[tool === "pencil" ? pencilSize : eraserSize]}
              onValueChange={(value) => (tool === "pencil" ? setPencilSize(value[0]) : setEraserSize(value[0]))}
              className="flex-1"
            />
            <span className="text-sm w-8 text-center">{tool === "pencil" ? pencilSize : eraserSize}</span>
          </div>
        </div>

        <div className="w-full aspect-[4/3] max-w-3xl">
          <canvas
            ref={canvasRef}
            className="w-full h-full border border-gray-600 rounded-lg cursor-crosshair touch-none"
            onMouseDown={(e) => startDrawing(e.clientX, e.clientY)}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseMove={(e) => draw(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              e.preventDefault()
              startDrawing(e.touches[0].clientX, e.touches[0].clientY)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              stopDrawing()
            }}
            onTouchMove={(e) => {
              e.preventDefault()
              draw(e.touches[0].clientX, e.touches[0].clientY)
            }}
          />
        </div>

        <Button onClick={analyzeImage} className="w-full max-w-[200px] mt-4" size="lg" disabled={isAnalyzing}>
          <Send className="h-5 w-5 mr-2" />
          {isAnalyzing ? "Analyzing..." : "Analyze Drawing"}
        </Button>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="w-full p-4 bg-gray-800 rounded-lg mt-4">
            <h2 className="text-xl font-semibold mb-2">ChalkX:</h2>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {result}
              </ReactMarkdown>
            </div>
          </div>

        )}
      </div>
    </div>
  )
}

