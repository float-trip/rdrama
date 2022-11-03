function pinPost(t, id) {
	t.disabled = true;
	t.classList.add("disabled");
	postToastCallback(`/sticky/${id}`,
		{
		},
		(xhr) => {
			if (xhr.status >= 200 && xhr.status < 300) {
				response = JSON.parse(xhr.response);
				length = response["length"];
				if (length == "permanently") {
					t.innerHTML = t.innerHTML.replace(t.textContent, 'Pin for 1 hour');
					t.classList.add('d-none');
				} else {
					t.innerHTML = t.innerHTML.replace(t.textContent, 'Pin permanently');
				}
				t.nextElementSibling.classList.remove('d-none');
				t.disabled = false;
				t.classList.remove("disabled");	
			}
		}
	);
	setTimeout(() => {
		t.disabled = false;
		t.classList.remove("disabled");
	}, 2000);
}

function unpinPost(t, id) {
	t.disabled = true;
	t.classList.add("disabled");
	postToastCallback(`/unsticky/${id}`,
		{
		},
		(xhr) => {
			if (xhr.status >= 200 && xhr.status < 300) {
				t.classList.add('d-none');
				t.previousElementSibling.classList.remove('d-none');
				t.disabled = false;
				t.classList.remove("disabled");	
			}
		}
	);
	setTimeout(() => {
		t.disabled = false;
		t.classList.remove("disabled");
	}, 2000);
}
