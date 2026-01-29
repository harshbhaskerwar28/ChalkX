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
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)

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
    setTool("pencil")
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
    setTool("pencil")
  }

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor)
    setIsColorPickerOpen(false)
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

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"
      const response = await fetch(`${backendUrl}/api/analyze`, {
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
    <div className="min-h-screen bg-black text-white p-2 xs:p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col items-center overflow-x-hidden" ref={containerRef}>
      <div className="w-full max-w-6xl flex flex-col items-center gap-3 xs:gap-4 sm:gap-5 md:gap-6 lg:gap-8">
        {/* Header */}
        <div className="text-center mt-3 xs:mt-4 sm:mt-5 md:mt-6 lg:mt-8 w-full">
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-widest" style={{ color: '#FF9500' }}>
            ChalkX
          </h1>
          <div className="w-8 xs:w-10 sm:w-12 md:w-14 lg:w-16 h-0.5 xs:h-1 bg-orange-500 mx-auto mt-2 xs:mt-3 md:mt-4"></div>
        </div>

        {/* Toolbar */}
        <div className="w-full bg-black border-4 border-orange-500 p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6">
          {/* Main Controls */}
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-1 xs:gap-2 sm:gap-2 md:gap-3 lg:gap-4 mb-3 xs:mb-4 sm:mb-5 md:mb-6">
            <Button
              onClick={() => setTool("pencil")}
              className={`h-auto flex flex-col items-center justify-center gap-0.5 xs:gap-1 sm:gap-1.5 relative ${
                tool === "pencil" ? "btn-orange-solid" : "btn-orange-outline"
              }`}
              title="Pencil Tool"
            >
              <Pencil className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-7 lg:w-7" />
              <span className="text-xs xs:text-xs sm:text-xs md:text-sm lg:text-sm whitespace-nowrap">PEN</span>
              {tool === "pencil" && <div className="btn-active-indicator"></div>}
            </Button>

            <Button
              onClick={() => setTool("eraser")}
              className={`h-auto flex flex-col items-center justify-center gap-0.5 xs:gap-1 sm:gap-1.5 relative ${
                tool === "eraser" ? "btn-orange-solid" : "btn-orange-outline"
              }`}
              title="Eraser Tool"
            >
              <Eraser className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-7 lg:w-7" />
              <span className="text-xs xs:text-xs sm:text-xs md:text-sm lg:text-sm whitespace-nowrap">ERASE</span>
              {tool === "eraser" && <div className="btn-active-indicator"></div>}
            </Button>

            <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="h-auto flex flex-col items-center justify-center gap-0.5 xs:gap-1 sm:gap-1.5 relative btn-calc"
                  style={{
                    borderColor: "#FF9500",
                    backgroundColor: color,
                    color: color === "#FFFFFF" || color === "#FFFF00" || color === "#FFC0CB" ? "#000000" : "#FFFFFF",
                    boxShadow: "0 6px 0 0 rgba(0, 0, 0, 0.9), 0 6px 20px rgba(0, 0, 0, 0.6)",
                  }}
                  title="Color Picker"
                >
                  <Palette className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                  <span className="text-xs xs:text-xs sm:text-xs md:text-sm lg:text-sm whitespace-nowrap">COLOR</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 xs:w-72 sm:w-80 md:w-80 lg:w-96 bg-black border-4 border-orange-500 p-3 xs:p-4 sm:p-5 md:p-6">
                <div className="grid grid-cols-6 gap-1.5 xs:gap-2 sm:gap-2 md:gap-3">
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
                      className="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 border-[3px] border-orange-500 transition-all duration-100 cursor-pointer"
                      style={{ 
                        backgroundColor: c,
                        boxShadow: "0 4px 0 0 rgba(0, 0, 0, 0.9), 0 4px 12px rgba(0, 0, 0, 0.5)",
                        transform: color === c ? "translateY(2px)" : "translateY(0px)",
                      }}
                      onClick={() => handleColorSelect(c)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button 
              onClick={clearCanvas} 
              className="h-auto flex flex-col items-center justify-center gap-0.5 xs:gap-1 sm:gap-1.5 relative btn-orange-outline"
              title="Clear Canvas"
            >
              <Trash2 className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-7 lg:w-7" />
              <span className="text-xs xs:text-xs sm:text-xs md:text-sm lg:text-sm whitespace-nowrap">CLEAR</span>
            </Button>

            <Button 
              onClick={downloadImage} 
              className="h-auto flex flex-col items-center justify-center gap-0.5 xs:gap-1 sm:gap-1.5 relative btn-orange-outline"
              title="Download Image"
            >
              <Download className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-7 lg:w-7" />
              <span className="text-xs xs:text-xs sm:text-xs md:text-sm lg:text-sm whitespace-nowrap">SAVE</span>
            </Button>
          </div>

          {/* Size Control */}
          <div className="bg-black border-4 border-orange-500 p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 xs:gap-2.5 sm:gap-3 md:gap-4 lg:gap-6">
              <span className="font-black text-orange-500 text-xs xs:text-xs sm:text-xs md:text-sm lg:text-base tracking-widest whitespace-nowrap">
                SIZE: {tool === "pencil" ? "PEN" : "ERASE"}
              </span>
              <Slider
                min={1}
                max={tool === "eraser" ? 50 : 20}
                step={1}
                value={[tool === "pencil" ? pencilSize : eraserSize]}
                onValueChange={(value) => (tool === "pencil" ? setPencilSize(value[0]) : setEraserSize(value[0]))}
                className="flex-1 w-full"
              />
              <span className="font-black text-orange-500 text-xs xs:text-xs sm:text-xs md:text-sm lg:text-base tracking-widest w-10 xs:w-11 sm:w-12 md:w-12 lg:w-14 text-center border-[3px] border-orange-500 bg-black py-0.5 xs:py-1 sm:py-1 md:py-1.5 lg:py-2">
                {tool === "pencil" ? pencilSize : eraserSize}
              </span>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="w-full aspect-[4/3] max-w-6xl">
          <canvas
            ref={canvasRef}
            className="canvas-border w-full h-full"
            onMouseDown={(e) => startDrawing(e.clientX, e.clientY)}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseMove={(e) => draw(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              startDrawing(e.touches[0].clientX, e.touches[0].clientY)
            }}
            onTouchEnd={() => {
              stopDrawing()
            }}
            onTouchMove={(e) => {
              draw(e.touches[0].clientX, e.touches[0].clientY)
            }}
          />
        </div>

        {/* Analyze Button */}
        <Button
          onClick={analyzeImage}
          className="w-full max-w-3xl btn-orange-solid py-4 xs:py-5 sm:py-6 md:py-7 lg:py-8 px-4 xs:px-5 sm:px-6 md:px-8 lg:px-10 mb-4 xs:mb-5 sm:mb-6 md:mb-7 lg:mb-8 flex flex-col items-center gap-1 xs:gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3"
          disabled={isAnalyzing}
        >
          <Send className="h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-7 lg:w-7" />
          <span className="tracking-widest font-black text-xs xs:text-xs sm:text-sm md:text-base lg:text-lg">
            {isAnalyzing ? "ANALYZING..." : "ANALYZE"}
          </span>
        </Button>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="w-full border-4 border-red-600 bg-black mb-3 xs:mb-4 sm:mb-5 md:mb-6">
            <AlertDescription className="text-red-500 font-black text-xs xs:text-xs sm:text-sm md:text-base">{error}</AlertDescription>
          </Alert>
        )}

        {/* Result */}
        {result && (
          <div className="w-full max-w-4xl bg-black border-4 border-orange-500 p-3 xs:p-3.5 sm:p-4 md:p-5">
            <h2 className="text-base xs:text-lg sm:text-xl md:text-xl font-black text-orange-500 mb-2 tracking-widest">
              ChalkX
            </h2>
            <div className="prose prose-invert max-w-none" style={{ fontSize: "88%" }}>
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

