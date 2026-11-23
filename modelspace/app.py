import os
import gradio as gr

# ModelScope Studio / Gradio 静态托管：把 web/ 目录作为静态资源，
# 首页以 iframe 全屏加载，公网用户直接打开 Space 即用。
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
INDEX_HTML = os.path.join(WEB_DIR, "index.html")
gr.set_static_paths([WEB_DIR])

# gradio >=5 把 API 路由（含静态文件 /file=）挂到 /gradio_api 前缀下，
# 读取已安装版本的实际前缀，兼容 4.x（根路径）与 5.x/6.x。
def _api_prefix() -> str:
    try:
        from gradio.route_utils import API_PREFIX
        return API_PREFIX or ""
    except Exception:
        try:
            return "/gradio_api" if int(gr.__version__.split(".")[0]) >= 5 else ""
        except Exception:
            return ""

with gr.Blocks(title="自由发 · 多平台一键发布", theme=gr.themes.Soft()) as demo:
    gr.HTML(
        f'<iframe src="{_api_prefix()}/file={INDEX_HTML}" '
        'style="width:100%;height:calc(100vh - 4px);border:0;display:block"></iframe>'
    )

if __name__ == "__main__":
    demo.launch()
