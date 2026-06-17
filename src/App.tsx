const importScene = useCallback((json: string): void => {
  try {
    const d = JSON.parse(json);

    stateRef.current.objects.forEach((o: CADObject) => disposeObject(o.mesh));

    const newObjs: CADObject[] = [];

    if (Array.isArray(d.objects)) {
      d.objects.forEach((od: any) => {
        const pos = new THREE.Vector3(od.position[0], od.position[1], od.position[2]);
        const rot = new THREE.Euler(od.rotation[0], od.rotation[1], od.rotation[2]);
        const scl = new THREE.Vector3(od.scale[0], od.scale[1], od.scale[2]);

        let mesh: THREE.Mesh | THREE.Line;

        if (od.type === 'line' || od.type === 'polyline') {
          mesh = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x00ff00 })
          );
        } else {
          mesh = new THREE.Mesh(
            new THREE.CircleGeometry(1, 48),
            new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide })
          );
        }

        mesh.position.copy(pos);
        mesh.rotation.copy(rot);
        mesh.scale.copy(scl);
        sceneRef.current?.add(mesh);

        newObjs.push({
          id: od.id || genId(),
          mesh,
          type: od.type as ToolType,
          geometry: mesh instanceof THREE.Mesh ? mesh.geometry : mesh.geometry,
          material: mesh.material,
          position: pos,
          rotation: rot,
          scale: scl,
          createdAt: od.createdAt || Date.now(),
        });
      });
    }

    setState(prev => ({ ...prev, objects: newObjs, selectedId: null }));
    stateRef.current = { ...stateRef.current, objects: newObjs, selectedId: null };

    if (d.viewMode) lockView(d.viewMode);
  } catch (err) {
    console.error('Import failed:', err);
  }
}, [disposeObject, genId, lockView]);