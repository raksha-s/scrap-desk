/** Resolves once every image under `root` has loaded or failed. Not img.decode(): that can stall for half a minute on off-screen images. */
export async function whenImagesLoaded(root: ParentNode, timeout = 5000): Promise<void> {
  await Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise<void>((res) => {
    const done = () => { clearTimeout(t); res(); };
    const t = setTimeout(done, timeout);
    img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true });
  }))));
}
