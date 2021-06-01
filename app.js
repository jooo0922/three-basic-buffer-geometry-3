'use strict';

import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';

function main() {
  // create WebGLRenderer
  const canvas = document.querySelector('#canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas
  });

  // create camera
  const fov = 75;
  const aspect = 2;
  const near = 0.1;
  const far = 100;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 3;

  // create scene
  const scene = new THREE.Scene();

  // 직사광 조명을 전달받은 위치값을 할당하여 생성하는 함수
  function addLight(...pos) {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...pos);
    scene.add(light);
  }
  addLight(-1, 2, 4);
  addLight(2, -2, 3);

  // 이제부터 구체를 BuffetGeometry로 만들어서 구체의 vertex를 동적으로 수정하는 애니메이션을 만들어볼거임.
  // 이런식으로 vertex의 일부를 동적으로 수정하고 싶다면 형식화 배열을 사용해 vertex의 attribute를 저장해서 사용하는 게 나음.
  // 아래는 구체의 vertex, 정확히 구체의 위치값과 인덱스를 생성하는 코드인데, 이번 챕터에서는 코드만 나와있고, 나중 챕터에서 더 자세히 다루겠다고 함.
  // 일단 지금은 makeSpherePosition 함수가 구체의 위치값 배열을 형식화 배열로 만들고, 해당 배열의 인덱스 값들을 구해서 리턴해준다는 것만 알고 있으면 될 듯...
  function makeSpherePositions(segmentsAround, segmentsDown) {
    const numVertices = segmentsAround * segmentsDown * 6;
    const numComponents = 3;
    const positions = new Float32Array(numVertices * numComponents);
    const indices = [];

    const longHelper = new THREE.Object3D();
    const latHelper = new THREE.Object3D();
    const pointHelper = new THREE.Object3D();
    longHelper.add(latHelper);
    latHelper.add(pointHelper);
    pointHelper.position.z = 1;
    const temp = new THREE.Vector3();

    function getPoint(lat, long) {
      latHelper.rotation.x = lat;
      longHelper.rotation.y = long;
      longHelper.updateMatrixWorld(true);
      return pointHelper.getWorldPosition(temp).toArray();
    }

    let posNdx = 0;
    let ndx = 0;
    for (let down = 0; down < segmentsDown; ++down) {
      const v0 = down / segmentsDown;
      const v1 = (down + 1) / segmentsDown;
      const lat0 = (v0 - 0.5) * Math.PI;
      const lat1 = (v1 - 0.5) * Math.PI;

      for (let across = 0; across < segmentsAround; ++across) {
        const u0 = across / segmentsAround;
        const u1 = (across + 1) / segmentsAround;
        const long0 = u0 * Math.PI * 2;
        const long1 = u1 * Math.PI * 2;

        positions.set(getPoint(lat0, long0), posNdx);
        posNdx += numComponents;
        positions.set(getPoint(lat1, long0), posNdx);
        posNdx += numComponents;
        positions.set(getPoint(lat0, long1), posNdx);
        posNdx += numComponents;
        positions.set(getPoint(lat1, long1), posNdx);
        posNdx += numComponents;

        indices.push(
          ndx, ndx + 1, ndx + 2,
          ndx + 2, ndx + 1, ndx + 3,
        );
        ndx += 4;
      }
    }
    return {
      positions,
      indices
    };
  }

  // 함수를 호출하여 const positions, const indices에 각각 위치값 배열(형식화 배열), 인덱스값 배열을 할당해 줌.
  const segmentsAround = 24;
  const segmentsDown = 16; // 각 구체 지오메트리를 위도, 경도 방향으로 나누는 횟수 
  const {
    positions,
    indices
  } = makeSpherePositions(segmentsAround, segmentsDown);

  // 반환받은 positions(위치값)은 구체에서는 법선의 값(normals)과 동일하기 때문에 그냥 위치값을 복사해서 그대로 할당해주면 됨.
  // array.slice() 메서드는 어떤 배열의 처음 인덱스부터 끝 인덱스까지 얕은 복사본을 새로운 배열 객체로 반환함. 원본 배열은 바뀌지 않음.
  const normals = positions.slice();

  // bufferGeometry를 생성함
  const geometry = new THREE.BufferGeometry();
  const positionNumComponents = 3;
  const normalNumComponents = 3;
  // 여기서 만드는 bufferGeometry는 텍스쳐를 입히지 않을 것이므로, vertex를 positions, normals로만 지정해줄거임.
  // 따라서 BuffetAttribute에 전닳해 줄 '하나의 꼭지점에 몇 개의 요소를 사용할 지 지정해주는 값들'도 position과 normal것만 준비해놓으면 됨.

  const positionAttribute = new THREE.BufferAttribute(positions, positionNumComponents);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  // 해당 위치값 형식화 배열(positions)를 할당한 buffetAttribute는 animate 함수에서 매 프레임마다 위치값을 계산하여 바꿔줄거기 때문에
  // 속덩을 DynamicDrawUsage 즉, 동적이라고 명시함. 이렇게 하면 three.js에게 해당 속성을 자주 변경할 것임을 알려주는 거임.
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, normalNumComponents));
  geometry.setIndex(indices); // 이전 예제에서 했던 것처럼 중복되는 vertex data를 지운 채로 사용할 경우 index로 지워진 vertex data를 불러오도록 하는 것임.

  // 퐁-머티리얼을 생성하고, 위에서 만든 BufferGeometry와 퐁-머리티얼로 메쉬를 생성하는 함수.
  function makeInstance(geometry, color, x) {
    const material = new THREE.MeshPhongMaterial({
      color,
      side: THREE.DoubleSide, // 해당 메쉬의 양면을 모두 렌더링해야 함. 왜냐면 animate 함수에서 구체 메쉬의 각 사분면을 앞뒤로 움직이게 하기 때문에 사분면의 안쪽 면이 보일 수 있음.
      shininess: 100, // highlight 부분의 밝기를 얼마나 강하게 처리해 줄 것인지 설정함. 기본값은 30
    });

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    cube.position.x = x;
    return cube;
  }

  // animate 함수에서 꺼내 쓸 수 있도록 메쉬를 배열 안에 담아놓음.
  const cubes = [
    makeInstance(geometry, 0xFF0000, 0)
  ];

  // resize
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  // 이제 animate 함수에서 매 프레임마다 bufferGeometry의 법선(normal)을 기준으로 위치값을 변경해줄거임.
  const temp = new THREE.Vector3();

  function animate(t) {
    t *= 0.001; // 밀리초 단위의 타임스탬프값을 초 단위로 변환함.

    // 카메라의 비율(aspect)도 리사이징이 일어나면 변경해 줌
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    // positions(위치값 형식화 배열) 길이만큼 for loop를 반복하여 처리해 줌.
    for (let i = 0; i < positions.length; i += 3) {
      const quad = (i / 12 | 0);
      const ringId = quad / segmentsAround | 0;
      const ringQuadId = quad % segmentsAround;
      const ringU = ringQuadId / segmentsAround;
      const angle = ringU * Math.PI * 2; // lerp()메소드의 비율값 계산에 필요한 값들을 계산하는거 같은데 정확히 어떤 값들인지는 설명을 안해줬음...
      temp.fromArray(normals, i); // 이거는 뭐냐면, temp라는 Vector3 객체의 x, y, z값을 각각 normals[0 + i], normals[1 + i], normals[2 + i] 이거로 설정해주라는 뜻. -> 위치값 변경의 기준이 될 법선 좌표값을 Vector3에 할당해 놓은거임.
      temp.multiplyScalar(THREE.MathUtils.lerp(1, 1.4, Math.sin(t + ringId + angle) * 0.5 + 0.5)); // 잘은 모르지만 일단 t(비율값)은 t(초 단위 타임스탬프값)값과 for loop의 i값으로 계산된다는 정도로 이해할 것...
      // sin 메소드에서 리턴해주는 -1 ~ 1사이의 값에 0.5를 곱하고(-0.5 ~ 0.5), 0.5를 더하면(0 ~ 1) 사이의 값을 t(비율값)으로 하여 1 ~ 1.4 사이의 값에서 t값에 비례하는 값을 리턴해주고,
      // 그 값을 법선(normals)의 좌표값이 할당된 Vector3의 x, y, z에 각각 곱해주는거지. -> 이렇게 하면 temp는 법선을 기준으로 변경된 위치값이 되는거지?
      temp.toArray(positions, i); // normal값을 기준으로 계산해준 변경된 위치값 x, y, z를 낱개로 복사하여 positions 형식화 배열의 i번째부터 넣어주라는 거지
      // (normals와 positions는 배열의 길이와 값 모두 동일하니까 같은 인덱스값으로 넣어줘도 상관없겠지)
    }

    // 마지막으로 positionAttribute.needsUpdate 속성을 활성화해 positionAttribute에 들어가는 positions 형식화 배열의 변화를 감지하도록 함.
    positionAttribute.needsUpdate = true;

    // bufferGeometry로 만든 구체 메쉬 전체를 y축으로 회전시켜주는 코드
    cubes.forEach((cube, index) => {
      const speed = -0.2 + index * 0.1;
      const rotate = t * speed;
      cube.rotation.y = rotate;
    });

    // buffer geometry의 positions 형식화 배열과 구체 메쉬의 애니메이션 계산이 끝나면, render()메소드로 렌더러에 씬과 카메라를 추가함.
    renderer.render(scene, camera);

    // 마지막으로 animate 함수를 내부에서 반복 호출함.
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

main();