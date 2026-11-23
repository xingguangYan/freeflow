import os
import gradio as gr

# ModelScope Studio / Gradio 静态托管：把 web/ 目录作为静态资源，
# 首页以 iframe 全屏加载，公网用户直接打开 Space 即用。
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
gr.set_static_paths([WEB_DIR])

with gr.Blocks(title="自由发 · 多平台一键发布", theme=gr.themes.Soft()) as demo:
    gr.HTML(
        '<iframe src="/file=web/index.html" '
        'style="width:100%;height:calc(100vh - 4px);border:0;display:block"></iframe>'
    )

if __name__ == "__main__":
    demo.launch()
